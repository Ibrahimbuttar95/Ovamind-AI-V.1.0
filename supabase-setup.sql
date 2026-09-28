-- 1. Users / access table
CREATE TABLE IF NOT EXISTS users (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  whop_user_id        TEXT UNIQUE,
  email               TEXT UNIQUE,
  is_lifetime_member  BOOLEAN DEFAULT FALSE,
  plan                TEXT DEFAULT 'lifetime',
  status              TEXT DEFAULT 'inactive',   -- active | inactive | refunded
  paid_at             TIMESTAMPTZ,
  renewed_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Auto-update timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 3. Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_users_whop_id ON users(whop_user_id);
CREATE INDEX IF NOT EXISTS idx_users_email   ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status  ON users(status);

-- 4. Row Level Security — only service role can write
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Service role (your Netlify functions) can do everything
CREATE POLICY "Service role full access" ON users
  FOR ALL USING (auth.role() = 'service_role');


