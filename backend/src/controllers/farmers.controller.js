const db = require('../config/db');

/**
 * Full journey summary for one farmer: profile, latest crop, latest
 * token/queue position, latest procurement, latest payment. This
 * powers the farmer home dashboard in one call.
 */
async function getFarmerSummary(req, res) {
  const { id } = req.params;

  // Only the farmer themselves, or staff, may view this.
  if (req.user.role === 'farmer' && String(req.user.farmerId) !== String(id)) {
    return res.status(403).json({ error: 'You can only view your own record' });
  }

  const farmerResult = await db.query(
    `SELECT f.id, f.farmer_code, f.address, u.name, u.phone, u.language
     FROM farmers f JOIN users u ON u.id = f.user_id WHERE f.id = $1`,
    [id]
  );
  const farmer = farmerResult.rows[0];
  if (!farmer) return res.status(404).json({ error: 'Farmer not found' });

  const cropsResult = await db.query(
    `SELECT id, crop_type, quantity_bags, harvest_date, status, created_at
     FROM crops WHERE farmer_id = $1 ORDER BY created_at DESC`,
    [id]
  );

  const tokenResult = await db.query(
    `SELECT t.id, t.token_number, t.status, t.queue_position, t.slot_id,
            s.slot_date, s.start_time, s.end_time, c.name AS centre_name
     FROM tokens t
     JOIN slots s ON s.id = t.slot_id
     JOIN centres c ON c.id = s.centre_id
     WHERE t.farmer_id = $1
     ORDER BY t.created_at DESC LIMIT 1`,
    [id]
  );

  const paymentsResult = await db.query(
    `SELECT id, amount, status, transaction_reference, processed_at
     FROM payments WHERE farmer_id = $1 ORDER BY processed_at DESC NULLS LAST LIMIT 5`,
    [id]
  );

  return res.json({
    farmer,
    crops: cropsResult.rows,
    latestToken: tokenResult.rows[0] || null,
    recentPayments: paymentsResult.rows
  });
}

async function searchFarmers(req, res) {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Query param q is required (farmer code, name or phone)' });

  const result = await db.query(
    `SELECT f.id, f.farmer_code, u.name, u.phone
     FROM farmers f JOIN users u ON u.id = f.user_id
     WHERE f.farmer_code ILIKE $1 OR u.name ILIKE $1 OR u.phone ILIKE $1
     LIMIT 20`,
    [`%${q}%`]
  );
  return res.json(result.rows);
}

async function updateFarmer(req, res) {
  const { id } = req.params;
  const { address, language, phone } = req.body;

  if (req.user.role === 'farmer' && String(req.user.farmerId) !== String(id)) {
    return res.status(403).json({ error: 'You can only edit your own record' });
  }

  await db.query(`UPDATE farmers SET address = COALESCE($1, address) WHERE id = $2`, [address, id]);

  if (phone || language) {
    await db.query(
      `UPDATE users SET phone = COALESCE($1, phone), language = COALESCE($2, language)
       WHERE id = (SELECT user_id FROM farmers WHERE id = $3)`,
      [phone, language, id]
    );
  }

  return res.json({ success: true });
}

module.exports = { getFarmerSummary, searchFarmers, updateFarmer };
