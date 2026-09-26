const db = require('../config/db');
const { notifyFarmer } = require('../utils/notify');

async function listNotificationsForFarmer(req, res) {
  const { id } = req.params;

  if (req.user.role === 'farmer' && String(req.user.farmerId) !== String(id)) {
    return res.status(403).json({ error: 'You can only view your own notifications' });
  }

  const result = await db.query(
    `SELECT * FROM notifications WHERE farmer_id = $1 ORDER BY sent_at DESC LIMIT 50`,
    [id]
  );
  return res.json(result.rows);
}

/**
 * Manual trigger, mainly for demoing the SMS channel live from the
 * operator/officer dashboard ("resend as SMS").
 */
async function sendNotification(req, res) {
  const { farmerId, message, channel, phone } = req.body;
  if (!farmerId || !message) {
    return res.status(400).json({ error: 'farmerId and message are required' });
  }

  await notifyFarmer(farmerId, message, { channel: channel || 'APP', phone });
  return res.status(201).json({ success: true });
}

module.exports = { listNotificationsForFarmer, sendNotification };
