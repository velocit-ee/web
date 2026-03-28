-- velocit.ee database schema
-- Run from the app directory as the velocitee OS user:
--   psql -d velocitee -f db/schema.sql
--
-- Idempotent: safe to run on an existing database (uses IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS waitlist (
  id         SERIAL       PRIMARY KEY,
  email      VARCHAR(320) NOT NULL,
  ip_hash    CHAR(64)     NOT NULL,
  source     VARCHAR(255) NOT NULL DEFAULT 'website',
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT waitlist_email_unique UNIQUE (email)
);

CREATE INDEX IF NOT EXISTS idx_waitlist_created_at
  ON waitlist (created_at DESC);
