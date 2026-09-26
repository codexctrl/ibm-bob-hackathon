const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { generateFarmerCode } = require('../utils/tokenGenerator');

function signToken(user, farmerId) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, farmerId: farmerId || null },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
}

/**
 * Self-service registration - used by the farmer app when a farmer
 * has a smartphone and registers themselves.
 */
async function register(req, res) {
  const { name, phone, username, password, language, address } = req.body;

  if (!name || !username || !password) {
    return res.status(400).json({ error: 'name, username and password are required' });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const userResult = await client.query(
      `INSERT INTO users (name, phone, username, password_hash, role, language)
       VALUES ($1, $2, $3, $4, 'farmer', $5) RETURNING id, name, phone, username, role, language`,
      [name, phone || null, username, passwordHash, language || 'en']
    );
    const user = userResult.rows[0];

    const farmerResult = await client.query(
      `INSERT INTO farmers (user_id, farmer_code, address) VALUES ($1, $2, $3) RETURNING id, farmer_code`,
      [user.id, generateFarmerCode(user.id), address || null]
    );
    const farmer = farmerResult.rows[0];

    await client.query('COMMIT');

    const token = signToken(user, farmer.id);
    return res.status(201).json({ token, user, farmer });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Login for any role (farmer, operator, officer, admin).
 */
async function login(req, res) {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' });
  }

  const result = await db.query(`SELECT * FROM users WHERE username = $1`, [username]);
  const user = result.rows[0];
  if (!user) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  let farmerId = null;
  if (user.role === 'farmer') {
    const farmerResult = await db.query(`SELECT id FROM farmers WHERE user_id = $1`, [user.id]);
    farmerId = farmerResult.rows[0] ? farmerResult.rows[0].id : null;
  }

  const token = signToken(user, farmerId);
  const { password_hash, ...safeUser } = user;
  return res.json({ token, user: { ...safeUser, farmerId } });
}

/**
 * Operator-assisted registration - for a farmer with no smartphone.
 * Requires an operator/admin token.
 */
async function assistedRegister(req, res) {
  const { name, phone, address, language } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }

  // Auto-generate a username/password for farmers who will never log in
  // themselves; the operator/hub manages access on their behalf.
  const autoUsername = `farmer_${Date.now()}`;
  const autoPassword = Math.random().toString(36).slice(-8);
  const passwordHash = await bcrypt.hash(autoPassword, 10);

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const userResult = await client.query(
      `INSERT INTO users (name, phone, username, password_hash, role, language)
       VALUES ($1, $2, $3, $4, 'farmer', $5) RETURNING id, name, phone, username, role`,
      [name, phone || null, autoUsername, passwordHash, language || 'en']
    );
    const user = userResult.rows[0];

    const farmerResult = await client.query(
      `INSERT INTO farmers (user_id, farmer_code, address, registered_by)
       VALUES ($1, $2, $3, $4) RETURNING id, farmer_code`,
      [user.id, generateFarmerCode(user.id), address || null, req.user.id]
    );
    const farmer = farmerResult.rows[0];

    await client.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id) VALUES ($1, 'assisted_register', 'farmer', $2)`,
      [req.user.id, farmer.id]
    );

    await client.query('COMMIT');
    return res.status(201).json({ farmer, user: { id: user.id, name: user.name, phone: user.phone } });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { register, login, assistedRegister };
