/**
 * AI-assisted procurement rate suggestion for officers.
 *
 * GET /procurement/rate-suggestion?tokenId=<id>
 *
 * Uses IBM watsonx.ai (Granite) to suggest an advisory rate per bag
 * based on crop type, quality grade, weight, and recent procurement
 * history from the CropFlow database.
 *
 * The response is ALWAYS labelled as advisory. The officer enters and
 * confirms the final rate themselves — this endpoint cannot approve or
 * reject a procurement.
 *
 * If watsonx.ai credentials are absent or the call fails, the endpoint
 * returns a graceful "unavailable" response (200 OK, advisory: null)
 * rather than an error, so the officer UI degrades cleanly.
 */
const db = require('../config/db');
const watsonx = require('../utils/watsonx');

/** How many recent approved procurements to include as context. */
const HISTORY_ROWS = 5;

/**
 * Builds the prompt sent to Granite.
 */
function buildPrompt({ cropType, qualityGrade, qualityStatus, netWeightKg, history }) {
  const historyText = history.length
    ? history
        .map((h) => `  - ${h.crop_type}, Grade ${h.quality_grade || 'N/A'}, ${h.net_weight_kg} kg → ₹${h.rate_per_bag}/bag`)
        .join('\n')
    : '  No recent history available.';

  return `You are an agricultural procurement advisor for CropFlow, a crop procurement management system in India.

An officer is about to approve the procurement of a crop and needs a suggested rate per bag (in Indian Rupees).

Current crop details:
  Crop type:      ${cropType}
  Quality grade:  ${qualityGrade || 'Not graded'}
  Quality status: ${qualityStatus}
  Net weight:     ${netWeightKg} kg

Recent approved rates at this centre (last ${HISTORY_ROWS} procurements):
${historyText}

Based on the crop type, quality, and recent rates, suggest a fair rate per bag in INR. Consider that higher grades and better quality should command higher rates. Respond with ONLY a short advisory in this exact format:

Suggested rate: ₹<number>/bag
Reasoning: <one sentence>

Do not approve or reject the procurement. The officer makes the final decision.`;
}

/**
 * Parses the model output to extract the numeric rate.
 * Returns null if no valid number is found.
 */
function parseSuggestedRate(text) {
  // Match "Suggested rate: ₹612/bag" or "Suggested rate: ₹612.50/bag"
  const match = text.match(/suggested\s+rate\s*[:\-]?\s*[₹Rs.]*\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (!match) return null;
  const num = parseFloat(match[1].replace(/,/g, ''));
  return Number.isFinite(num) && num > 0 ? num : null;
}

async function getRateSuggestion(req, res) {
  const { tokenId } = req.query;
  if (!tokenId || !/^\d+$/.test(String(tokenId))) {
    return res.status(400).json({ error: 'tokenId query parameter is required and must be a number' });
  }

  // Fetch the token + procurement + crop data.
  const tokenResult = await db.query(
    `SELECT t.id, c.crop_type, c.quantity_bags,
            pr.net_weight_kg, pr.quality_grade, pr.quality_status
     FROM tokens t
     JOIN crops c ON c.id = t.crop_id
     LEFT JOIN procurement pr ON pr.token_id = t.id
     WHERE t.id = $1`,
    [tokenId]
  );

  const row = tokenResult.rows[0];
  if (!row) {
    return res.status(404).json({ error: 'Token not found' });
  }

  if (!row.net_weight_kg) {
    return res.status(409).json({ error: 'Weighing has not been recorded for this token yet' });
  }

  // Fetch recent approved rate history for the same crop type.
  const historyResult = await db.query(
    `SELECT c.crop_type, pr.quality_grade, pr.net_weight_kg, pr.rate_per_bag
     FROM procurement pr
     JOIN tokens t ON t.id = pr.token_id
     JOIN crops c ON c.id = t.crop_id
     WHERE pr.status = 'APPROVED'
       AND c.crop_type = $1
       AND pr.rate_per_bag IS NOT NULL
     ORDER BY pr.processed_at DESC NULLS LAST
     LIMIT $2`,
    [row.crop_type, HISTORY_ROWS]
  );

  // Graceful degradation: if watsonx is not configured, return advisory: null.
  if (!watsonx.isConfigured()) {
    return res.json({
      advisory: null,
      reason: 'AI suggestions are not available (watsonx.ai credentials not configured)',
      configured: false
    });
  }

  const prompt = buildPrompt({
    cropType: row.crop_type,
    qualityGrade: row.quality_grade,
    qualityStatus: row.quality_status || 'PENDING',
    netWeightKg: row.net_weight_kg,
    history: historyResult.rows
  });

  let rawText;
  try {
    rawText = await watsonx.generate(prompt, { maxNewTokens: 120, timeoutMs: 15000 });
  } catch (aiErr) {
    // Log the error but return a clean advisory-unavailable response,
    // not a 500 — the officer can still enter a rate manually.
    console.error('[rate-suggestion] watsonx.ai call failed:', aiErr.message);
    return res.json({
      advisory: null,
      reason: 'AI suggestion unavailable (provider error)',
      configured: true
    });
  }

  const suggestedRate = parseSuggestedRate(rawText);

  return res.json({
    advisory: suggestedRate,
    rawText,
    configured: true,
    disclaimer:
      'This is an AI-generated suggestion only. The officer must review and enter the final rate.'
  });
}

module.exports = { getRateSuggestion };
