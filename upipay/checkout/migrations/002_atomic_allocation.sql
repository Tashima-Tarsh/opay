-- OPAY atomic allocation and settlement-safe matching (PostgreSQL 16).
-- Apply after 001_multi_vpa.sql. All monetary values are integer paise.
CREATE OR REPLACE FUNCTION opay_allocate_vpa(
  p_order uuid, p_amount_paise bigint, p_ttl_seconds integer DEFAULT 600,
  p_grace_seconds integer DEFAULT 600
) RETURNS TABLE (reservation_id uuid, account_id bigint, assigned_vpa text, expires_at timestamptz, grace_until timestamptz)
LANGUAGE plpgsql AS $$
DECLARE a record; existing record; rid uuid;
BEGIN
  IF p_amount_paise <= 0 OR p_ttl_seconds NOT BETWEEN 60 AND 3600
     OR p_grace_seconds NOT BETWEEN 60 AND 3600 THEN
    RAISE EXCEPTION 'Invalid allocation parameters';
  END IF;
  SELECT r.id, r.vpa_id, v.vpa, r.expires_at, r.grace_until
  INTO existing FROM opay_vpa_reservations r JOIN opay_vpa_accounts v ON v.id=r.vpa_id
  WHERE r.order_id=p_order;
  IF FOUND THEN
    RETURN QUERY SELECT existing.id, existing.vpa_id, existing.vpa, existing.expires_at, existing.grace_until;
    RETURN;
  END IF;
  SELECT v.id,v.vpa INTO a FROM opay_vpa_accounts v
  WHERE v.enabled AND v.health='HOT'
    AND (v.cooldown_until IS NULL OR v.cooldown_until<=now())
    AND v.daily_used_paise+p_amount_paise<=v.daily_cap_paise
    AND NOT EXISTS (
      SELECT 1 FROM opay_vpa_reservations r WHERE r.vpa_id=v.id AND r.released_at IS NULL
    )
  ORDER BY v.daily_used_paise,v.id
  FOR UPDATE OF v SKIP LOCKED LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;
  rid:=gen_random_uuid();
  INSERT INTO opay_vpa_reservations(id,order_id,vpa_id,amount_paise,expires_at,grace_until)
  VALUES (rid,p_order,a.id,p_amount_paise,
    now()+make_interval(secs=>p_ttl_seconds),
    now()+make_interval(secs=>p_ttl_seconds+p_grace_seconds));
  RETURN QUERY SELECT r.id,r.vpa_id,a.vpa,r.expires_at,r.grace_until
    FROM opay_vpa_reservations r WHERE r.id=rid;
END $$;

-- Release only after the grace period; never release while a matched credit is present.
CREATE OR REPLACE FUNCTION opay_release_expired_vpas()
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE n integer;
BEGIN
  WITH expired AS (
    SELECT r.id FROM opay_vpa_reservations r
    WHERE r.released_at IS NULL AND r.grace_until < now()
      AND NOT EXISTS (
        SELECT 1 FROM opay_inbound_credits c
        WHERE c.matched_order_id=r.order_id
      )
    FOR UPDATE SKIP LOCKED
  )
  UPDATE opay_vpa_reservations r SET released_at=now()
  FROM expired e WHERE r.id=e.id;
  GET DIAGNOSTICS n=ROW_COUNT;
  RETURN n;
END $$;

-- Only authenticated and reconciled source evidence can produce VERIFIED.
-- The credit row must already have been inserted by a trusted, authenticated ingestion path.
CREATE OR REPLACE FUNCTION opay_match_credit(p_credit_id bigint)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE c record; r record; reason text;
BEGIN
  SELECT * INTO c FROM opay_inbound_credits WHERE id=p_credit_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'CREDIT_NOT_FOUND'; END IF;
  IF c.matched_order_id IS NOT NULL THEN RETURN 'ALREADY_MATCHED'; END IF;
  IF NOT (c.source_authenticated AND c.source_reconciled) THEN
    UPDATE opay_inbound_credits SET review_reason='UNVERIFIED_SOURCE' WHERE id=p_credit_id;
    RETURN 'UNVERIFIED_SOURCE';
  END IF;
  SELECT * INTO r FROM opay_vpa_reservations
  WHERE vpa_id=c.vpa_id AND released_at IS NULL
    AND c.bank_ts>=created_at-interval '90 seconds'
    AND c.bank_ts<=grace_until
  ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN reason:='NO_RESERVED_ORDER';
  ELSIF c.amount_paise<r.amount_paise THEN reason:='PARTIAL_AMOUNT';
  ELSIF c.amount_paise>r.amount_paise THEN reason:='OVERPAY';
  ELSIF EXISTS (SELECT 1 FROM opay_inbound_credits d
     WHERE d.id<>c.id AND d.utr=c.utr AND d.vpa_id=c.vpa_id AND d.matched_order_id IS NOT NULL)
    THEN reason:='DUPLICATE_REFERENCE';
  ELSE
    UPDATE opay_inbound_credits SET matched_order_id=r.order_id,review_reason=NULL WHERE id=c.id;
    INSERT INTO opay_payment_audit(actor,order_id,event,payload)
    VALUES ('credit-matcher',r.order_id,'CREDIT_MATCHED',
      jsonb_build_object('credit_id',c.id,'source',c.source_type,'amount_paise',c.amount_paise));
    RETURN 'VERIFIED';
  END IF;
  UPDATE opay_inbound_credits SET review_reason=reason WHERE id=p_credit_id;
  RETURN reason;
END $$;
