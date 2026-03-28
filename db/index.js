'use strict';

const { Pool } = require('pg');
const crypto   = require('crypto');

// ── PostgreSQL pool via Unix socket (peer auth — no password) ─────────────────
const pool = new Pool({
  host:     process.env.PGHOST     || '/var/run/postgresql',
  database: process.env.PGDATABASE || 'velocitee',
  user:     process.env.PGUSER     || 'velocitee',
});

pool.on('error', (err) => {
  console.error('[db] unexpected pool error:', err.message);
});

// ── IP hashing ────────────────────────────────────────────────────────────────
// We never store raw IP addresses. HMAC-SHA256 with a secret salt is
// one-way and resistant to rainbow-table attacks.
function hashIP(ip) {
  const salt = process.env.IP_HASH_SALT;
  if (!salt) throw new Error('IP_HASH_SALT env var must be set');
  return crypto.createHmac('sha256', salt).update(String(ip || '')).digest('hex');
}

module.exports = { pool, hashIP };
