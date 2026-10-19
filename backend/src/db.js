const { Pool } = require('pg');
const databaseUrl = process.env.DATABASE_URL;
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});
pool.on('error', error => console.error('Unexpected PostgreSQL pool error:', error.message));
module.exports = { pool, query: (text, params) => pool.query(text, params), isConfigured: Boolean(databaseUrl) };
