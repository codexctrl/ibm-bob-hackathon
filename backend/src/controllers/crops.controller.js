const db = require('../config/db');

async function createCrop(req, res) {
  const { farmerId, cropType, quantityBags, harvestDate } = req.body;
  const resolvedFarmerId = req.user.role === 'farmer' ? req.user.farmerId : farmerId;

  if (!resolvedFarmerId || !cropType || !quantityBags) {
    return res.status(400).json({ error: 'farmerId, cropType and quantityBags are required' });
  }

  const result = await db.query(
    `INSERT INTO crops (farmer_id, crop_type, quantity_bags, harvest_date, status)
     VALUES ($1, $2, $3, $4, 'REGISTERED') RETURNING *`,
    [resolvedFarmerId, cropType, quantityBags, harvestDate || null]
  );

  return res.status(201).json(result.rows[0]);
}

async function listCropsForFarmer(req, res) {
  const { id } = req.params;

  if (req.user.role === 'farmer' && String(req.user.farmerId) !== String(id)) {
    return res.status(403).json({ error: 'You can only view your own crops' });
  }

  const result = await db.query(
    `SELECT * FROM crops WHERE farmer_id = $1 ORDER BY created_at DESC`,
    [id]
  );
  return res.json(result.rows);
}

async function updateCropStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;
  const allowed = ['REGISTERED', 'ARRIVED', 'WEIGHED', 'QUALITY_CHECKED', 'PROCURED', 'REJECTED'];

  if (!allowed.includes(status)) {
    return res.status(400).json({ error: `status must be one of ${allowed.join(', ')}` });
  }

  const result = await db.query(
    `UPDATE crops SET status = $1 WHERE id = $2 RETURNING *`,
    [status, id]
  );

  if (!result.rows[0]) return res.status(404).json({ error: 'Crop not found' });
  return res.json(result.rows[0]);
}

module.exports = { createCrop, listCropsForFarmer, updateCropStatus };
