const db = require('../config/db');
const { notifyFarmer } = require('../utils/notify');

/**
 * Officer records gate/weighing result and opens the procurement
 * record for a token. Called once the token has reached WEIGHING.
 */
async function recordWeighing(req, res) {
  const { tokenId, netWeightKg } = req.body;
  if (!tokenId || !netWeightKg) {
    return res.status(400).json({ error: 'tokenId and netWeightKg are required' });
  }

  const tokenResult = await db.query(`SELECT farmer_id FROM tokens WHERE id = $1`, [tokenId]);
  if (!tokenResult.rows[0]) return res.status(404).json({ error: 'Token not found' });

  const result = await db.query(
    `INSERT INTO procurement (token_id, net_weight_kg, status, processed_by)
     VALUES ($1, $2, 'PENDING', $3)
     ON CONFLICT (token_id) DO UPDATE SET net_weight_kg = EXCLUDED.net_weight_kg
     RETURNING *`,
    [tokenId, netWeightKg, req.user.id]
  );

  await db.query(`UPDATE tokens SET status = 'WEIGHING', updated_at = NOW() WHERE id = $1`, [tokenId]);

  return res.status(201).json(result.rows[0]);
}

/**
 * Officer records the quality check outcome.
 */
async function recordQualityCheck(req, res) {
  const { tokenId, qualityGrade, qualityStatus } = req.body;
  if (!['PASSED', 'FAILED'].includes(qualityStatus)) {
    return res.status(400).json({ error: 'qualityStatus must be PASSED or FAILED' });
  }

  const procResult = await db.query(
    `UPDATE procurement SET quality_grade = $1, quality_status = $2 WHERE token_id = $3 RETURNING *`,
    [qualityGrade || null, qualityStatus, tokenId]
  );
  if (!procResult.rows[0]) return res.status(404).json({ error: 'Procurement record not found for this token' });

  await db.query(
    `UPDATE tokens SET status = 'QUALITY_CHECK', updated_at = NOW() WHERE id = $1`,
    [tokenId]
  );

  const tokenResult = await db.query(`SELECT farmer_id, token_number FROM tokens WHERE id = $1`, [tokenId]);
  const { farmer_id: farmerId, token_number: tokenNumber } = tokenResult.rows[0];

  const message = qualityStatus === 'PASSED'
    ? `Your crop has passed quality verification for token ${tokenNumber}.`
    : `Quality check for token ${tokenNumber} did not pass. Please contact the centre for details.`;
  await notifyFarmer(farmerId, message, { channel: 'APP' });

  return res.json(procResult.rows[0]);
}

/**
 * Officer approves (or rejects) the procurement and sets the amount.
 * On approval this also creates the pending payment record, keeping
 * the "arrival to payment" chain unbroken in one transaction.
 */
async function approveProcurement(req, res) {
  const { tokenId, ratePerBag, decision } = req.body; // decision: 'APPROVED' | 'REJECTED'
  if (!['APPROVED', 'REJECTED'].includes(decision)) {
    return res.status(400).json({ error: 'decision must be APPROVED or REJECTED' });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const cropResult = await client.query(
      `SELECT c.quantity_bags, t.farmer_id, t.token_number
       FROM tokens t JOIN crops c ON c.id = t.crop_id WHERE t.id = $1`,
      [tokenId]
    );
    if (!cropResult.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Token not found' });
    }
    const { quantity_bags: quantityBags, farmer_id: farmerId, token_number: tokenNumber } = cropResult.rows[0];

    const approvedAmount = decision === 'APPROVED' ? Number(ratePerBag) * Number(quantityBags) : 0;

    const procResult = await client.query(
      `UPDATE procurement
       SET rate_per_bag = $1, approved_amount = $2, status = $3, processed_by = $4, processed_at = NOW()
       WHERE token_id = $5 RETURNING *`,
      [ratePerBag || null, approvedAmount, decision, req.user.id, tokenId]
    );
    if (!procResult.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Procurement record not found for this token' });
    }
    const procurement = procResult.rows[0];

    await client.query(
      `UPDATE tokens SET status = 'PROCUREMENT', updated_at = NOW() WHERE id = $1`,
      [tokenId]
    );
    await client.query(
      `UPDATE crops SET status = $1 WHERE id = (SELECT crop_id FROM tokens WHERE id = $2)`,
      [decision === 'APPROVED' ? 'PROCURED' : 'REJECTED', tokenId]
    );

    if (decision === 'APPROVED') {
      await client.query(
        `INSERT INTO payments (farmer_id, procurement_id, amount, status)
         VALUES ($1, $2, $3, 'PENDING')`,
        [farmerId, procurement.id, approvedAmount]
      );
    }

    await client.query('COMMIT');

    await notifyFarmer(
      farmerId,
      decision === 'APPROVED'
        ? `Procurement approved for token ${tokenNumber}. Amount: Rs.${approvedAmount.toFixed(2)}. Payment will follow shortly.`
        : `Procurement for token ${tokenNumber} was rejected.`,
      { channel: 'APP' }
    );

    return res.json(procurement);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { recordWeighing, recordQualityCheck, approveProcurement };
