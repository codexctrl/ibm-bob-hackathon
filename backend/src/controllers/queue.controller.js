const db = require('../config/db');
const { estimateWaitMinutes } = require('../utils/waitTimeEstimator');

/**
 * Live queue for a given centre (today, or a given date), for the
 * officer dashboard: every active token in order of queue position.
 */
async function getCentreQueue(req, res) {
  const { centreId } = req.params;
  const { date } = req.query;

  const result = await db.query(
    `SELECT t.id, t.token_number, t.status, t.queue_position, t.slot_id,
            u.name AS farmer_name, c.crop_type, c.quantity_bags
     FROM tokens t
     JOIN slots s ON s.id = t.slot_id
     JOIN farmers f ON f.id = t.farmer_id
     JOIN users u ON u.id = f.user_id
     JOIN crops c ON c.id = t.crop_id
     WHERE s.centre_id = $1
       AND s.slot_date = COALESCE($2, CURRENT_DATE)
       AND t.status NOT IN ('COMPLETED', 'CANCELLED')
     ORDER BY t.queue_position ASC`,
    [centreId, date || null]
  );

  return res.json(result.rows);
}

/**
 * A single farmer's live position + transparent wait-time estimate
 * for their own token, shown on the farmer app's "Live Queue" screen.
 */
async function getTokenQueueStatus(req, res) {
  const { tokenId } = req.params;

  const tokenResult = await db.query(
    `SELECT t.id, t.token_number, t.status, t.queue_position, t.slot_id,
            ce.active_counters, ce.avg_minutes_per_farmer
     FROM tokens t
     JOIN slots s ON s.id = t.slot_id
     JOIN centres ce ON ce.id = s.centre_id
     WHERE t.id = $1`,
    [tokenId]
  );
  const token = tokenResult.rows[0];
  if (!token) return res.status(404).json({ error: 'Token not found' });

  const aheadResult = await db.query(
    `SELECT COUNT(*) AS ahead FROM tokens
     WHERE slot_id = $1 AND queue_position < $2 AND status NOT IN ('COMPLETED', 'CANCELLED')`,
    [token.slot_id, token.queue_position]
  );
  const farmersAhead = parseInt(aheadResult.rows[0].ahead, 10);

  const estimate = estimateWaitMinutes({
    farmersAhead,
    activeCounters: token.active_counters,
    avgMinutesPerFarmer: parseFloat(token.avg_minutes_per_farmer)
  });

  return res.json({
    tokenNumber: token.token_number,
    status: token.status,
    queuePosition: token.queue_position,
    farmersAhead,
    estimatedWaitMinutes: estimate.minutes,
    explanation: estimate.explanation
  });
}

module.exports = { getCentreQueue, getTokenQueueStatus };
