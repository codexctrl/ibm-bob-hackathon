const { Pool } = require('pg');
require('dotenv').config();

// Single shared connection pool. All queries in the app should go
// through this pool rather than opening ad-hoc clients, so we don't
// exhaust Postgres connection limits during the hackathon demo.
const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: process.env.PGPORT || 5432,
  database: process.env.PGDATABASE || 'cropflow',
  user: process.env.PGUSER || 'cropflow_user',
  password: process.env.PGPASSWORD || '',
  max: 10,
  idleTimeoutMillis: 30000
});

pool.on('error', (err) => {
  // eslint-disable-next-line no-console
  console.error('Unexpected error on idle Postgres client', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
  pool
};
