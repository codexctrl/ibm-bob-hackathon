const db = require('../config/db');
const { notifyFarmer } = require('../utils/notify');

/**
 * Officer records gate/weighing result and opens the procurement
 * record for a token. Called once the token has reached WEIGHING.
 *
 * The INSERT and the token status update run in one transaction so
 * they cannot diverge if either query fails.
 */
async function recordWeighing(req, res) {
  const { tokenId, netWeightKg } = req.body;

  if (!tokenId) {
    return res.status(400).json({ error: 'tokenId is required' });
  }

  const weight = Number(netWeightKg);
  if (!Number.isFinite(weight) || weight <= 0) {
    return res.status(400).json({ error: 'netWeightKg must be a positive number' });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const tokenResult = await client.query(
      `SELECT farmer_id, status FROM tokens WHERE id = $1 FOR UPDATE`,
      [tokenId]
    );
    const token = tokenResult.rows[0];
    if (!token) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Token not found' });
    }
    if (token.status !== 'WEIGHING') {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: `Token must be in WEIGHING status to record weight (current: ${token.status})`
      });
    }

    const result = await client.query(
      `INSERT INTO procurement (token_id, net_weight_kg, status, processed_by)
       VALUES ($1, $2, 'PENDING', $3)
       ON CONFLICT (token_id) DO UPDATE SET net_weight_kg = EXCLUDED.net_weight_kg
       RETURNING *`,
      [tokenId, weight, req.user.id]
    );

    await client.query(
      `UPDATE tokens SET status = 'QUALITY_CHECK', updated_at = NOW() WHERE id = $1`,
      [tokenId]
    );

    await client.query('COMMIT');
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Officer records the quality check outcome.
 *
 * PASSED  → token advances to PROCUREMENT (eligible for approval)
 * FAILED  → token is CANCELLED; crop is marked REJECTED.
 *
 * Both updates run in a single transaction.
 */
async function recordQualityCheck(req, res) {
  const { tokenId, qualityGrade, qualityStatus } = req.body;

  if (!tokenId) {
    return res.status(400).json({ error: 'tokenId is required' });
  }
  if (!['PASSED', 'FAILED'].includes(qualityStatus)) {
    return res.status(400).json({ error: 'qualityStatus must be PASSED or FAILED' });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const tokenResult = await client.query(
      `SELECT t.farmer_id, t.token_number, t.status, t.crop_id
       FROM tokens t WHERE t.id = $1 FOR UPDATE`,
      [tokenId]
    );
    const token = tokenResult.rows[0];
    if (!token) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Token not found' });
    }
    if (token.status !== 'QUALITY_CHECK') {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: `Token must be in QUALITY_CHECK status to record quality (current: ${token.status})`
      });
    }

    const procResult = await client.query(
      `UPDATE procurement
       SET quality_grade = $1, quality_status = $2
       WHERE token_id = $3
       RETURNING *`,
      [qualityGrade || null, qualityStatus, tokenId]
    );
    if (!procResult.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Procurement record not found for this token' });
    }

    // PASSED → advance to PROCUREMENT; FAILED → cancel the token and reject the crop.
    const nextTokenStatus = qualityStatus === 'PASSED' ? 'PROCUREMENT' : 'CANCELLED';
    await client.query(
      `UPDATE tokens SET status = $1, updated_at = NOW() WHERE id = $2`,
      [nextTokenStatus, tokenId]
    );

    if (qualityStatus === 'FAILED') {
      await client.query(
        `UPDATE crops SET status = 'REJECTED' WHERE id = $1`,
        [token.crop_id]
      );
      // Shift queue positions for tokens that were behind this one.
      const posResult = await client.query(
        `SELECT queue_position, slot_id FROM tokens WHERE id = $1`,
        [tokenId]
      );
      if (posResult.rows[0]) {
        const { queue_position, slot_id } = posResult.rows[0];
        await client.query(
          `UPDATE tokens SET queue_position = queue_position - 1
           WHERE slot_id = $1 AND queue_position > $2
             AND status NOT IN ('COMPLETED', 'CANCELLED')`,
          [slot_id, queue_position]
        );
      }
    }

    await client.query('COMMIT');

    const message = qualityStatus === 'PASSED'
      ? `Your crop has passed quality verification for token ${token.token_number}.`
      : `Quality check for token ${token.token_number} did not pass. Please contact the centre for details.`;

    try {
      await notifyFarmer(token.farmer_id, message, { channel: 'APP' });
    } catch (notificationError) {
      console.error('Quality check notification failed:', notificationError);
    }

    return res.json(procResult.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Officer approves (or rejects) the procurement and sets the amount.
 * On approval this also creates the pending payment record, keeping
 * the "arrival to payment" chain unbroken in one transaction.
 *
 * Guards:
 * - Token must be in PROCUREMENT status.
 * - Quality check must have PASSED before approval is allowed.
 * - Procurement must not already be APPROVED or REJECTED (no double-processing).
 * - ratePerBag must be a positive finite number when approving.
 */
async function approveProcurement(req, res) {
  const { tokenId, ratePerBag, decision } = req.body;

  if (!tokenId) {
    return res.status(400).json({ error: 'tokenId is required' });
  }
  if (!['APPROVED', 'REJECTED'].includes(decision)) {
    return res.status(400).json({ error: 'decision must be APPROVED or REJECTED' });
  }
  if (decision === 'APPROVED') {
    const rate = Number(ratePerBag);
    if (!Number.isFinite(rate) || rate <= 0) {
      return res.status(400).json({ error: 'ratePerBag must be a positive number when approving' });
    }
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const tokenRow = await client.query(
      `SELECT t.status, t.farmer_id, t.token_number,
              c.quantity_bags, c.id AS crop_id
       FROM tokens t
       JOIN crops c ON c.id = t.crop_id
       WHERE t.id = $1
       FOR UPDATE OF t`,
      [tokenId]
    );
    if (!tokenRow.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Token not found' });
    }
    const { status: tokenStatus, farmer_id: farmerId, token_number: tokenNumber,
            quantity_bags: quantityBags, crop_id: cropId } = tokenRow.rows[0];

    if (tokenStatus !== 'PROCUREMENT') {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: `Token must be in PROCUREMENT status to approve (current: ${tokenStatus})`
      });
    }

    const procRow = await client.query(
      `SELECT id, quality_status, status FROM procurement WHERE token_id = $1 FOR UPDATE`,
      [tokenId]
    );
    if (!procRow.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Procurement record not found for this token' });
    }
    const proc = procRow.rows[0];

    if (proc.quality_status !== 'PASSED') {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'Quality check must have PASSED before procurement can be approved'
      });
    }
    if (proc.status !== 'PENDING') {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: `Procurement has already been ${proc.status.toLowerCase()}`
      });
    }

    const approvedAmount = decision === 'APPROVED'
      ? Number(ratePerBag) * Number(quantityBags)
      : 0;

    const updatedProc = await client.query(
      `UPDATE procurement
       SET rate_per_bag = $1, approved_amount = $2, status = $3,
           processed_by = $4, processed_at = NOW()
       WHERE token_id = $5
       RETURNING *`,
      [ratePerBag || null, approvedAmount, decision, req.user.id, tokenId]
    );

    // Token always moves to COMPLETED after approval decision (approved or rejected).
    await client.query(
      `UPDATE tokens SET status = 'COMPLETED', updated_at = NOW() WHERE id = $1`,
      [tokenId]
    );

    // Crop status reflects the decision.
    await client.query(
      `UPDATE crops SET status = $1 WHERE id = $2`,
      [decision === 'APPROVED' ? 'PROCURED' : 'REJECTED', cropId]
    );

    // Shift queue positions for tokens behind this one.
    const posResult = await client.query(
      `SELECT queue_position, slot_id FROM tokens WHERE id = $1`,
      [tokenId]
    );
    if (posResult.rows[0]) {
      const { queue_position, slot_id } = posResult.rows[0];
      await client.query(
        `UPDATE tokens SET queue_position = queue_position - 1
         WHERE slot_id = $1 AND queue_position > $2
           AND status NOT IN ('COMPLETED', 'CANCELLED')`,
        [slot_id, queue_position]
      );
    }

    if (decision === 'APPROVED') {
      await client.query(
        `INSERT INTO payments (farmer_id, procurement_id, amount, status)
         VALUES ($1, $2, $3, 'PENDING')`,
        [farmerId, proc.id, approvedAmount]
      );
    }

    await client.query('COMMIT');

    const procurement = updatedProc.rows[0];

    try {
      await notifyFarmer(
        farmerId,
        decision === 'APPROVED'
          ? `Procurement approved for token ${tokenNumber}. Amount: Rs.${approvedAmount.toFixed(2)}. Payment will follow shortly.`
          : `Procurement for token ${tokenNumber} was rejected.`,
        { channel: 'APP' }
      );
    } catch (notificationError) {
      console.error('Procurement approval notification failed:', notificationError);
    }

    return res.json(procurement);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { recordWeighing, recordQualityCheck, approveProcurement };
