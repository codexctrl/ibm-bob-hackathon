const db = require('../config/db');

async function getOverview(req, res) {
  const [farmersToday, volumeToday, avgWait, pendingPayments, cropStats] = await Promise.all([
    db.query(`SELECT COUNT(*) FROM tokens t JOIN slots s ON s.id = t.slot_id WHERE s.slot_date = CURRENT_DATE`),
    db.query(`
      SELECT COALESCE(SUM(pr.net_weight_kg), 0) AS total_kg
      FROM procurement pr JOIN tokens t ON t.id = pr.token_id JOIN slots s ON s.id = t.slot_id
      WHERE s.slot_date = CURRENT_DATE AND pr.status = 'APPROVED'
    `),
    db.query(`
      SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (t.updated_at - t.created_at)) / 60), 0) AS avg_minutes
      FROM tokens t WHERE t.status = 'COMPLETED' AND t.created_at::date = CURRENT_DATE
    `),
    db.query(`SELECT COUNT(*), COALESCE(SUM(amount), 0) AS total FROM payments WHERE status = 'PENDING'`),
    db.query(`
      SELECT crop_type, COUNT(*) AS count, COALESCE(SUM(quantity_bags), 0) AS total_bags
      FROM crops GROUP BY crop_type ORDER BY total_bags DESC
    `)
  ]);

  return res.json({
    farmersToday: parseInt(farmersToday.rows[0].count, 10),
    totalKgProcuredToday: parseFloat(volumeToday.rows[0].total_kg),
    avgWaitMinutesToday: parseFloat(avgWait.rows[0].avg_minutes).toFixed(1),
    pendingPayments: {
      count: parseInt(pendingPayments.rows[0].count, 10),
      totalAmount: parseFloat(pendingPayments.rows[0].total)
    },
    cropStats: cropStats.rows
  });
}

async function getCentrePerformance(req, res) {
  const result = await db.query(`
    SELECT c.id, c.name,
           COUNT(t.id) FILTER (WHERE s.slot_date = CURRENT_DATE) AS tokens_today,
           COUNT(t.id) FILTER (WHERE s.slot_date = CURRENT_DATE AND t.status = 'COMPLETED') AS completed_today
    FROM centres c
    LEFT JOIN slots s ON s.centre_id = c.id
    LEFT JOIN tokens t ON t.slot_id = s.id
    GROUP BY c.id ORDER BY c.name
  `);
  return res.json(result.rows);
}

module.exports = { getOverview, getCentrePerformance };
