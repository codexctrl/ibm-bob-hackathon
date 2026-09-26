const db = require('../config/db');
const { sendSms } = require('./smsProvider');

/**
 * Records a notification for a farmer and, if channel is SMS,
 * actually sends it. Called by controllers whenever something
 * demo-worthy happens (slot booked, queue update, quality result,
 * payment processed, etc).
 */
async function notifyFarmer(farmerId, message, { channel = 'APP', phone } = {}) {
  await db.query(
    `INSERT INTO notifications (farmer_id, channel, message, status) VALUES ($1, $2, $3, 'SENT')`,
    [farmerId, channel, message]
  );

  if (channel === 'SMS' && phone) {
    try {
      await sendSms(phone, message);
    } catch (err) {
      await db.query(
        `UPDATE notifications SET status = 'FAILED' WHERE farmer_id = $1 AND message = $2`,
        [farmerId, message]
      );
    }
  }
}

module.exports = { notifyFarmer };
