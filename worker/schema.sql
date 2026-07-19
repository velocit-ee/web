-- velocit.ee D1 schema (SQLite dialect — ports db/schema.sql from Postgres).
-- Apply:  npx wrangler d1 execute velocitee --remote --file worker/schema.sql
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS waitlist (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  email      TEXT    NOT NULL UNIQUE,
  ip_hash    TEXT    NOT NULL,
  source     TEXT    NOT NULL DEFAULT 'website',
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_waitlist_created_at
  ON waitlist (created_at DESC);

-- Sliding-window rate limiting for the form endpoints. Rows older than 24h
-- are pruned opportunistically on write.
CREATE TABLE IF NOT EXISTS rate_events (
  scope   TEXT    NOT NULL,
  ip_hash TEXT    NOT NULL,
  ts      INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_events
  ON rate_events (scope, ip_hash, ts);
