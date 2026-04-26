-- ════════════════════════════════════════════════════════════════════════════
-- Phase 5: Audit trail + escalation DB objects
-- Run once against the live Supabase Postgres instance.
--
-- Usage (paste into Supabase Dashboard → SQL Editor, or via psql):
--   psql "$DATABASE_URL" -f src/lib/db/triggers.sql
-- ════════════════════════════════════════════════════════════════════════════


-- ── 1. log_mutation() ────────────────────────────────────────────────────────
-- SECURITY DEFINER: runs as the DB owner, bypassing RLS, so the trigger
-- can always INSERT into audit_log regardless of the calling user's role.
CREATE OR REPLACE FUNCTION log_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id          uuid        := gen_random_uuid();
  v_now         timestamptz := clock_timestamp();
  v_actor_id    uuid;
  v_resource_id uuid;
  v_before      jsonb;
  v_after       jsonb;
  v_prev_hash   text;
  v_row_hash    text;
BEGIN
  -- Extract the authenticated user from the Supabase JWT (null for system calls)
  BEGIN
    v_actor_id := (current_setting('request.jwt.claims', true)::jsonb->>'sub')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_actor_id := NULL;
  END;

  IF TG_OP = 'DELETE' THEN
    v_before      := to_jsonb(OLD);
    v_after       := NULL;
    v_resource_id := OLD.id;
  ELSIF TG_OP = 'INSERT' THEN
    v_before      := NULL;
    v_after       := to_jsonb(NEW);
    v_resource_id := NEW.id;
  ELSE -- UPDATE
    v_before      := to_jsonb(OLD);
    v_after       := to_jsonb(NEW);
    v_resource_id := NEW.id;
  END IF;

  -- Hash chain: last row_hash written for this resource, or 'GENESIS' for first entry
  SELECT row_hash INTO v_prev_hash
  FROM audit_log
  WHERE resource_type = TG_TABLE_NAME
    AND resource_id   = v_resource_id
  ORDER BY created_at DESC
  LIMIT 1;

  v_prev_hash := COALESCE(v_prev_hash, 'GENESIS');

  -- Row hash covers table + resource + operation + epoch timestamp + payload + chain link
  -- Using epoch avoids timezone text-representation variance during verification
  v_row_hash := md5(
    TG_TABLE_NAME                           || '|' ||
    COALESCE(v_resource_id::text, '')       || '|' ||
    TG_OP                                   || '|' ||
    extract(epoch FROM v_now)::text         || '|' ||
    COALESCE(v_after::text, 'null')         || '|' ||
    v_prev_hash
  );

  INSERT INTO audit_log (
    id, actor_id, action, resource_type, resource_id,
    "before", "after", prev_hash, row_hash, created_at
  ) VALUES (
    v_id, v_actor_id, TG_OP, TG_TABLE_NAME, v_resource_id,
    v_before, v_after, v_prev_hash, v_row_hash, v_now
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;


-- ── 2. Attach audit trigger to every business table ───────────────────────────
DO $do$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'roles', 'offices', 'users', 'role_permissions',
    'document_templates', 'documents', 'document_versions',
    'approval_routes', 'approval_steps', 'document_approvals',
    'signatures', 'escalation_rules'
  ] LOOP
    -- Drop then recreate makes this script idempotent
    EXECUTE format(
      'DROP TRIGGER IF EXISTS audit_%I ON %I;
       CREATE TRIGGER audit_%I
         AFTER INSERT OR UPDATE OR DELETE ON %I
         FOR EACH ROW EXECUTE FUNCTION log_mutation();',
      t, t, t, t
    );
  END LOOP;
END;
$do$;


-- ── 3. Document status-transition enforcement (L7) ────────────────────────────
-- Prevents any code path from writing an invalid status jump.
-- The WHEN clause skips the check when status is unchanged (saves overhead).
CREATE OR REPLACE FUNCTION enforce_document_status_transition()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NOT (
    (OLD.current_status = 'draft'     AND NEW.current_status = 'in_review')  OR
    (OLD.current_status = 'in_review' AND NEW.current_status IN ('approved', 'returned')) OR
    (OLD.current_status = 'approved'  AND NEW.current_status = 'archived')   OR
    (OLD.current_status = 'returned'  AND NEW.current_status = 'draft')
  ) THEN
    RAISE EXCEPTION 'Invalid document status transition: % → %',
      OLD.current_status, NEW.current_status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS documents_status_transition_check ON documents;
CREATE TRIGGER documents_status_transition_check
  BEFORE UPDATE ON documents
  FOR EACH ROW
  WHEN (OLD.current_status IS DISTINCT FROM NEW.current_status)
  EXECUTE FUNCTION enforce_document_status_transition();


-- ── 4. Hash-chain verification view ──────────────────────────────────────────
-- SELECT * FROM audit_verify WHERE NOT hash_valid  → detects tampered rows.
-- Uses the same epoch-based formula as log_mutation() for consistency.
CREATE OR REPLACE VIEW audit_verify WITH (security_invoker = true) AS
SELECT
  id,
  created_at,
  resource_type,
  resource_id,
  actor_id,
  action,
  prev_hash,
  row_hash,
  md5(
    resource_type                              || '|' ||
    COALESCE(resource_id::text, '')            || '|' ||
    action                                     || '|' ||
    extract(epoch FROM created_at)::text       || '|' ||
    COALESCE("after"::text, 'null')            || '|' ||
    COALESCE(prev_hash, 'GENESIS')
  ) = row_hash AS hash_valid
FROM audit_log
ORDER BY created_at;


-- ── 5. RPC helper for the escalation-scanner Edge Function ───────────────────
-- Returns every pending document_approval whose deadline has passed,
-- along with how many hours it is overdue and its current escalation level.
CREATE OR REPLACE FUNCTION get_overdue_approvals()
RETURNS TABLE (
  approval_id     uuid,
  document_id     uuid,
  assignee_id     uuid,
  route_id        uuid,
  hours_overdue   numeric,
  escalated_level text
)
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT
    da.id                                                              AS approval_id,
    da.document_id,
    da.assignee_id,
    das.route_id,
    ROUND(
      EXTRACT(EPOCH FROM (now() - da.created_at)) / 3600
      - das.deadline_hours,
      2
    )                                                                  AS hours_overdue,
    da.escalated_level::text
  FROM document_approvals da
  JOIN approval_steps das ON das.id = da.step_id
  JOIN documents      d   ON d.id   = da.document_id
  WHERE da.status          = 'pending'
    AND d.current_status   = 'in_review'
    AND da.created_at + (das.deadline_hours * INTERVAL '1 hour') < now();
$$;


-- ── 6. pg_cron setup ─────────────────────────────────────────────────────────
-- Prerequisites:
--   1. Enable pg_cron in Supabase Dashboard → Database → Extensions
--   2. Enable pg_net  in Supabase Dashboard → Database → Extensions
--   3. Deploy the escalation-scanner Edge Function (supabase/functions/escalation-scanner/)
--   4. Fill in <project-ref> and <service-role-key> below, then run in SQL Editor.
--
-- SELECT cron.schedule(
--   'escalation-scanner',
--   '0 * * * *',
--   $$
--   SELECT net.http_post(
--     url     := 'https://<project-ref>.supabase.co/functions/v1/escalation-scanner',
--     headers := jsonb_build_object('Authorization', 'Bearer <service-role-key>'),
--     body    := '{}'::jsonb
--   );
--   $$
-- );
