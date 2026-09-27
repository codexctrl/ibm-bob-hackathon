/**
 * Applies database/schema.sql and database/seed.sql (reference data
 * only) against the database configured in .env.
 * Usage: npm run migrate
 *
 * Safe to re-run: schema.sql guards every CREATE with IF NOT EXISTS /
 * DO $$ EXCEPTION blocks; seed.sql uses ON CONFLICT DO NOTHING.
 * No existing data is dropped or truncated.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function run() {
  const client = new Client({
    host: process.env.PGHOST,
    port: process.env.PGPORT,
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD
  });

  await client.connect();
  console.log('Connected to database. Applying schema...');

  try {
    const schemaSql = fs.readFileSync(path.join(__dirname, '../../database/schema.sql'), 'utf8');
    await client.query(schemaSql);
    console.log('Schema applied.');

    const seedSql = fs.readFileSync(path.join(__dirname, '../../database/seed.sql'), 'utf8');
    await client.query(seedSql);
    console.log('Reference data (centres, slots) seeded.');
  } finally {
    await client.end();
  }

  console.log('Done. Run "npm run seed" next to create demo users/farmers/tokens.');
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
