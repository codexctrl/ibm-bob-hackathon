const db = require('../config/db');
const { notifyFarmer } = require('../utils/notify');

async function listPaymentsForFarmer(req, res) {
  const { id } = req.params;

  if (req.user.role === 'farmer' && String(req.user.farmerId) !== String(id)) {
    return res.status(403).json({ error: 'You can only view your own payments' });
  }

  const result = await db.query(
    `SELECT p.*, pr.net_weight_kg, pr.quality_grade, t.token_number
     FROM payments p
     JOIN procurement pr ON pr.id = p.procurement_id
     JOIN tokens t ON t.id = pr.token_id
     WHERE p.farmer_id = $1
     ORDER BY p.processed_at DESC NULLS FIRST`,
    [id]
  );
  return res.json(result.rows);
}

/**
 * Marks a pending payment as processed. In a real deployment this
 * would be triggered by a bank/UPI webhook; for the hackathon demo
 * an officer/admin can trigger it manually with a mock reference.
 */
async function processPayment(req, res) {
  const { id } = req.params;
  const { transactionReference } = req.body;

  const result = await db.query(
    `UPDATE payments SET status = 'PROCESSED', transaction_reference = $1, processed_at = NOW()
     WHERE id = $2 RETURNING *`,
    [transactionReference || `TXN-${Date.now()}`, id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Payment not found' });

  const payment = result.rows[0];
  await notifyFarmer(
    payment.farmer_id,
    `Payment of Rs.${Number(payment.amount).toFixed(2)} has been processed. Reference: ${payment.transaction_reference}.`,
    { channel: 'APP' }
  );

  return res.json(payment);
}

module.exports = { listPaymentsForFarmer, processPayment };
