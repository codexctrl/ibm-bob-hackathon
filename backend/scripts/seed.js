/**
 * Seeds demo accounts and a full sample farmer journey so the app is
 * demo-ready immediately after `npm run migrate`.
 * Usage: npm run seed
 *
 * All demo accounts use the password: password123
 *
 * Idempotent: safe to re-run.
 *   - Users:        ON CONFLICT (username) DO UPDATE (refreshes name only)
 *   - Farmers:      SELECT first, INSERT only when absent
 *   - Crops:        SELECT by (farmer_id, crop_type); INSERT only when absent
 *   - Tokens:       SELECT by (farmer_id, crop_id, slot_id); INSERT only when absent
 *   - Procurement:  INSERT ... ON CONFLICT DO NOTHING
 *   - Payments:     INSERT ... ON CONFLICT DO NOTHING
 *   - Notifications: always appended (they are a log, duplicates are harmless)
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../src/config/db');
const { generateFarmerCode, generateTokenNumber } = require('../src/utils/tokenGenerator');

const DEMO_PASSWORD = 'password123';

async function upsertUser({ name, phone, username, role, language }) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const result = await db.query(
    `INSERT INTO users (name, phone, username, password_hash, role, language)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (username) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [name, phone, username, passwordHash, role, language || 'en']
  );
  return result.rows[0].id;
}

async function upsertFarmer(userId, address) {
  const existing = await db.query(`SELECT id FROM farmers WHERE user_id = $1`, [userId]);
  if (existing.rows[0]) return existing.rows[0].id;
  const result = await db.query(
    `INSERT INTO farmers (user_id, farmer_code, address) VALUES ($1, $2, $3) RETURNING id`,
    [userId, generateFarmerCode(userId), address]
  );
  return result.rows[0].id;
}

/**
 * Returns the id of an existing crop matching (farmer_id, crop_type),
 * or inserts a new one and returns its id.
 */
async function upsertCrop(farmerId, cropType, quantityBags, harvestDateExpr, status) {
  const existing = await db.query(
    `SELECT id FROM crops WHERE farmer_id = $1 AND crop_type = $2 LIMIT 1`,
    [farmerId, cropType]
  );
  if (existing.rows[0]) return existing.rows[0].id;
  const result = await db.query(
    `INSERT INTO crops (farmer_id, crop_type, quantity_bags, harvest_date, status)
     VALUES ($1, $2, $3, ${harvestDateExpr}, $4) RETURNING id`,
    [farmerId, cropType, quantityBags, status]
  );
  return result.rows[0].id;
}

/**
 * Returns the id of an existing token for (farmer_id, crop_id, slot_id),
 * or inserts a new one.
 */
async function upsertToken(farmerId, cropId, slotId, queuePosition, status) {
  const existing = await db.query(
    `SELECT id FROM tokens WHERE farmer_id = $1 AND crop_id = $2 AND slot_id = $3 LIMIT 1`,
    [farmerId, cropId, slotId]
  );
  if (existing.rows[0]) return existing.rows[0].id;

  const seq = await db.query(`SELECT nextval(pg_get_serial_sequence('tokens','id')) AS seq`);
  const tokenId = Number(seq.rows[0].seq);
  const tokenNumber = generateTokenNumber(tokenId);
  await db.query(
    `INSERT INTO tokens (id, token_number, farmer_id, crop_id, slot_id, queue_position, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [tokenId, tokenNumber, farmerId, cropId, slotId, queuePosition, status]
  );
  return tokenId;
}

async function run() {
  console.log('Seeding demo accounts (password for all: "password123")...');

  await upsertUser({ name: 'System Admin',    phone: '9000000001', username: 'admin',    role: 'admin' });
  await upsertUser({ name: 'Officer Meena',   phone: '9000000002', username: 'officer1', role: 'officer' });
  await upsertUser({ name: 'Operator Suresh', phone: '9000000003', username: 'operator1',role: 'operator' });

  const raviId    = await upsertUser({ name: 'Ravi Kumar',   phone: '9000000004', username: 'ravi',   role: 'farmer', language: 'ta' });
  const lakshmiId = await upsertUser({ name: 'Lakshmi Devi', phone: '9000000005', username: 'lakshmi',role: 'farmer', language: 'ta' });
  const muthuId   = await upsertUser({ name: 'Muthu Selvam', phone: '9000000006', username: 'muthu',  role: 'farmer', language: 'ta' });

  const raviFarmerId    = await upsertFarmer(raviId,    'Village Road, Thanjavur');
  const lakshmiFarmerId = await upsertFarmer(lakshmiId, 'Kavery Nagar, Trichy');
  const muthuFarmerId   = await upsertFarmer(muthuId,   'North Street, Erode');

  console.log('Seeding sample crops and one full arrival-to-payment journey...');

  const paddyCropId  = await upsertCrop(raviFarmerId,    'Paddy',    100, 'CURRENT_DATE - 2', 'ARRIVED');
  const sugarCropId  = await upsertCrop(lakshmiFarmerId, 'Sugarcane', 60, 'CURRENT_DATE - 1', 'REGISTERED'); // eslint-disable-line no-unused-vars
  const cottonCropId = await upsertCrop(muthuFarmerId,   'Cotton',    40, 'CURRENT_DATE - 3', 'PROCURED');

  // Grab two upcoming seeded slots to attach tokens to.
  const slotsResult = await db.query(
    `SELECT id FROM slots WHERE slot_date >= CURRENT_DATE ORDER BY slot_date, start_time LIMIT 2`
  );
  if (slotsResult.rows.length < 2) {
    throw new Error('Expected at least 2 upcoming slots — run "npm run migrate" first.');
  }
  const [slotA, slotB] = slotsResult.rows;

  await upsertToken(raviFarmerId,  paddyCropId,  slotA.id, 12, 'WEIGHING');
  await upsertToken(lakshmiFarmerId, sugarCropId, slotB.id, 5, 'WAITING');
  const completedTokenId = await upsertToken(muthuFarmerId, cottonCropId, slotA.id, 1, 'COMPLETED');

  // Procurement for the completed token — idempotent via ON CONFLICT DO NOTHING.
  const procResult = await db.query(
    `INSERT INTO procurement (token_id, net_weight_kg, quality_grade, quality_status,
                              rate_per_bag, approved_amount, status, processed_at)
     VALUES ($1, 1980.00, 'A', 'PASSED', 612.50, 24500.00, 'APPROVED', NOW() - INTERVAL '1 day')
     ON CONFLICT (token_id) DO NOTHING
     RETURNING id`,
    [completedTokenId]
  );

  // Payment — only insert if procurement was just created (procResult has a row).
  if (procResult.rows[0]) {
    await db.query(
      `INSERT INTO payments (farmer_id, procurement_id, amount, status, transaction_reference, processed_at)
       VALUES ($1, $2, 24500.00, 'PROCESSED', 'TXN-DEMO-001', NOW() - INTERVAL '12 hours')
       ON CONFLICT (procurement_id) DO NOTHING`,
      [muthuFarmerId, procResult.rows[0].id]
    );
  }

  await db.query(
    `INSERT INTO notifications (farmer_id, channel, message, status) VALUES
     ($1, 'SMS', 'Your procurement slot is tomorrow, 10:00-11:00 AM. Token generated.', 'SENT'),
     ($1, 'APP', 'Current queue: 12 farmers. Estimated wait: 35 minutes.', 'SENT'),
     ($2, 'SMS', 'Payment of Rs.24,500 has been processed.', 'SENT')`,
    [raviFarmerId, muthuFarmerId]
  );

  console.log('Seed complete. Demo logins (password: password123):');
  console.log('  admin / officer1 / operator1 / ravi / lakshmi / muthu');
  process.exit(0);
}

run().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
