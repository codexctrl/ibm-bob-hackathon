/**
 * Seeds demo accounts and a full sample farmer journey so the app is
 * demo-ready immediately after `npm run migrate`.
 * Usage: npm run seed
 *
 * All demo accounts use the password: password123
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

async function run() {
  console.log('Seeding demo accounts (password for all: "password123")...');

  await upsertUser({ name: 'System Admin', phone: '9000000001', username: 'admin', role: 'admin' });
  await upsertUser({ name: 'Officer Meena', phone: '9000000002', username: 'officer1', role: 'officer' });
  await upsertUser({ name: 'Operator Suresh', phone: '9000000003', username: 'operator1', role: 'operator' });

  const raviId = await upsertUser({ name: 'Ravi Kumar', phone: '9000000004', username: 'ravi', role: 'farmer', language: 'ta' });
  const lakshmiId = await upsertUser({ name: 'Lakshmi Devi', phone: '9000000005', username: 'lakshmi', role: 'farmer', language: 'ta' });
  const muthuId = await upsertUser({ name: 'Muthu Selvam', phone: '9000000006', username: 'muthu', role: 'farmer', language: 'ta' });

  async function upsertFarmer(userId, address) {
    const existing = await db.query(`SELECT id FROM farmers WHERE user_id = $1`, [userId]);
    if (existing.rows[0]) return existing.rows[0].id;
    const result = await db.query(
      `INSERT INTO farmers (user_id, farmer_code, address) VALUES ($1, $2, $3) RETURNING id`,
      [userId, generateFarmerCode(userId), address]
    );
    return result.rows[0].id;
  }

  const raviFarmerId = await upsertFarmer(raviId, 'Village Road, Thanjavur');
  const lakshmiFarmerId = await upsertFarmer(lakshmiId, 'Kavery Nagar, Trichy');
  const muthuFarmerId = await upsertFarmer(muthuId, 'North Street, Erode');

  console.log('Seeding sample crops and one full arrival-to-payment journey...');

  const paddyCrop = await db.query(
    `INSERT INTO crops (farmer_id, crop_type, quantity_bags, harvest_date, status)
     VALUES ($1, 'Paddy', 100, CURRENT_DATE - 2, 'ARRIVED') RETURNING id`,
    [raviFarmerId]
  );
  await db.query(
    `INSERT INTO crops (farmer_id, crop_type, quantity_bags, harvest_date, status)
     VALUES ($1, 'Sugarcane', 60, CURRENT_DATE - 1, 'REGISTERED')`,
    [lakshmiFarmerId]
  );
  const cottonCrop = await db.query(
    `INSERT INTO crops (farmer_id, crop_type, quantity_bags, harvest_date, status)
     VALUES ($1, 'Cotton', 40, CURRENT_DATE - 3, 'PROCURED') RETURNING id`,
    [muthuFarmerId]
  );

  // Grab two existing seeded slots to attach tokens to.
  const slotsResult = await db.query(`SELECT id FROM slots ORDER BY id LIMIT 2`);
  if (slotsResult.rows.length < 2) {
    throw new Error('Expected at least 2 slots to exist - run "npm run migrate" first.');
  }
  const [slotA, slotB] = slotsResult.rows;

  async function issueDemoToken(farmerId, cropId, slotId, queuePosition, status) {
    const seq = await db.query(`SELECT nextval(pg_get_serial_sequence('tokens','id')) AS seq`);
    const tokenNumber = generateTokenNumber(seq.rows[0].seq);
    await db.query(
      `INSERT INTO tokens (id, token_number, farmer_id, crop_id, slot_id, queue_position, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [seq.rows[0].seq, tokenNumber, farmerId, cropId, slotId, queuePosition, status]
    );
    return { id: seq.rows[0].seq, tokenNumber };
  }

  await issueDemoToken(raviFarmerId, paddyCrop.rows[0].id, slotA.id, 12, 'WEIGHING');
  await issueDemoToken(lakshmiFarmerId, 1, slotB.id, 5, 'WAITING');
  const completedToken = await issueDemoToken(muthuFarmerId, cottonCrop.rows[0].id, slotA.id, 1, 'COMPLETED');

  const procurementResult = await db.query(
    `INSERT INTO procurement (token_id, net_weight_kg, quality_grade, quality_status, rate_per_bag, approved_amount, status, processed_at)
     VALUES ($1, 1980.00, 'A', 'PASSED', 612.50, 24500.00, 'APPROVED', NOW() - INTERVAL '1 day')
     RETURNING id`,
    [completedToken.id]
  );

  await db.query(
    `INSERT INTO payments (farmer_id, procurement_id, amount, status, transaction_reference, processed_at)
     VALUES ($1, $2, 24500.00, 'PROCESSED', 'TXN-DEMO-001', NOW() - INTERVAL '12 hours')`,
    [muthuFarmerId, procurementResult.rows[0].id]
  );

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
