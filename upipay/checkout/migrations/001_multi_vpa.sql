-- OPAY multi-VPA foundation. Additive migration; existing checkout stays unchanged.
-- Amounts are integer paise to avoid floating-point matching errors.
CREATE TABLE IF NOT EXISTS opay_vpa_accounts (
  id bigserial PRIMARY KEY,
  vpa text NOT NULL UNIQUE,
  holder_name text NOT NULL,
  bank text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('bank_api','psp','sms','email','statement')),
  enabled boolean NOT NULL DEFAULT false,
  health text NOT NULL DEFAULT 'WARM' CHECK (health IN ('HOT','WARM','COOLING','DEAD')),
  daily_cap_paise bigint NOT NULL DEFAULT 9000000 CHECK (daily_cap_paise >= 0),
  daily_used_paise bigint NOT NULL DEFAULT 0 CHECK (daily_used_paise >= 0),
  cooldown_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS opay_vpa_reservations (
  id uuid PRIMARY KEY,
  order_id uuid NOT NULL UNIQUE,
  vpa_id bigint NOT NULL REFERENCES opay_vpa_accounts(id),
  amount_paise bigint NOT NULL CHECK (amount_paise > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  grace_until timestamptz NOT NULL,
  released_at timestamptz,
  CHECK (expires_at > created_at AND grace_until > expires_at)
);
-- A VPA remains exclusive until the grace window has elapsed AND a sweeper releases it.
CREATE UNIQUE INDEX IF NOT EXISTS opay_one_unreleased_vpa
 ON opay_vpa_reservations (vpa_id) WHERE released_at IS NULL;
CREATE TABLE IF NOT EXISTS opay_inbound_credits (
  id bigserial PRIMARY KEY,
  vpa_id bigint NOT NULL REFERENCES opay_vpa_accounts(id),
  amount_paise bigint NOT NULL CHECK (amount_paise > 0),
  utr text NOT NULL CHECK (utr ~ '^[0-9]{12}$'),
  bank_ts timestamptz NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('bank_api','psp','sms','email','statement')),
  source_event_id text NOT NULL,
  source_authenticated boolean NOT NULL DEFAULT false,
  source_reconciled boolean NOT NULL DEFAULT false,
  remitter_vpa text,
  raw jsonb NOT NULL,
  matched_order_id uuid UNIQUE,
  review_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_type, source_event_id)
);
-- A reference is not necessarily globally unique across all banks and time.
CREATE UNIQUE INDEX IF NOT EXISTS opay_unique_credit_reference_per_vpa
 ON opay_inbound_credits (vpa_id, utr, bank_ts, amount_paise);
CREATE TABLE IF NOT EXISTS opay_payment_audit (
  id bigserial PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  actor text NOT NULL,
  order_id uuid,
  event text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);
-- Example allocation transaction (parameter $1=order UUID, $2=amount paise):
-- BEGIN;
-- SELECT id FROM opay_vpa_accounts a
-- WHERE enabled AND health='HOT' AND (cooldown_until IS NULL OR cooldown_until <= now())
--   AND daily_used_paise + $2 <= daily_cap_paise
--   AND NOT EXISTS (SELECT 1 FROM opay_vpa_reservations r WHERE r.vpa_id=a.id AND r.released_at IS NULL)
-- ORDER BY daily_used_paise, id FOR UPDATE OF a SKIP LOCKED LIMIT 1;
-- INSERT INTO opay_vpa_reservations (...); COMMIT;
-- Never set PAID based on a typed UTR, a return redirect, or unverified SMS/email.
