-- LOTO15 PostgreSQL schema (also created automatically by db.js on first boot)
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  access_hash TEXT NOT NULL,
  mode TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  email TEXT,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  paid_at TIMESTAMPTZ,
  expired_at TIMESTAMPTZ,
  generated_at TIMESTAMPTZ,
  payment JSONB,
  games JSONB,
  email_result JSONB
);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status);
CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders(created_at DESC);
CREATE TABLE IF NOT EXISTS events (
  id BIGSERIAL PRIMARY KEY,
  at TIMESTAMPTZ NOT NULL,
  type TEXT NOT NULL,
  order_id TEXT,
  extra JSONB
);
CREATE INDEX IF NOT EXISTS events_at_idx ON events(at DESC);
CREATE TABLE IF NOT EXISTS idempotency (
  key TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
