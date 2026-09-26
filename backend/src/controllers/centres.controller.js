const db = require('../config/db');

async function listCentres(req, res) {
  const result = await db.query(`SELECT * FROM centres ORDER BY name`);
  return res.json(result.rows);
}

async function getCentre(req, res) {
  const { id } = req.params;
  const result = await db.query(`SELECT * FROM centres WHERE id = $1`, [id]);
  if (!result.rows[0]) return res.status(404).json({ error: 'Centre not found' });
  return res.json(result.rows[0]);
}

/**
 * Workload snapshot used by the admin dashboard and the "smart
 * arrival recommendation" feature: how busy is each centre right now.
 */
async function centreWorkload(req, res) {
  const result = await db.query(`
    SELECT c.id, c.name, c.active_counters, c.avg_minutes_per_farmer,
           COUNT(t.id) FILTER (WHERE t.status NOT IN ('COMPLETED', 'CANCELLED')) AS farmers_in_queue
    FROM centres c
    LEFT JOIN slots s ON s.centre_id = c.id AND s.slot_date = CURRENT_DATE
    LEFT JOIN tokens t ON t.slot_id = s.id
    GROUP BY c.id
    ORDER BY farmers_in_queue DESC
  `);
  return res.json(result.rows);
}

module.exports = { listCentres, getCentre, centreWorkload };
