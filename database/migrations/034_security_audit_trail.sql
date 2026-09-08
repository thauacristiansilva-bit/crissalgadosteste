BEGIN;

ALTER TABLE sf_audit_log
  ADD COLUMN IF NOT EXISTS event_category text NOT NULL DEFAULT 'application',
  ADD COLUMN IF NOT EXISTS outcome text NOT NULL DEFAULT 'success',
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'application',
  ADD COLUMN IF NOT EXISTS request_id text,
  ADD COLUMN IF NOT EXISTS session_id text,
  ADD COLUMN IF NOT EXISTS actor_role text,
  ADD COLUMN IF NOT EXISTS ip_hash text,
  ADD COLUMN IF NOT EXISTS user_agent_hash text;

UPDATE sf_audit_log
SET event_category = CASE
  WHEN action LIKE 'security.%' THEN 'security'
  WHEN action LIKE 'legal.%' THEN 'legal'
  WHEN action LIKE 'onboarding.%' THEN 'onboarding'
  WHEN action LIKE 'crm.%' OR action LIKE 'loyalty.%' THEN 'crm'
  WHEN action LIKE 'integration.%' THEN 'integration'
  ELSE event_category
END
WHERE event_category = 'application';

CREATE INDEX IF NOT EXISTS sf_audit_log_org_action_created_idx
  ON sf_audit_log (organization_id, action, created_at DESC);

CREATE INDEX IF NOT EXISTS sf_audit_log_org_category_created_idx
  ON sf_audit_log (organization_id, event_category, created_at DESC);

CREATE INDEX IF NOT EXISTS sf_audit_log_security_created_idx
  ON sf_audit_log (created_at DESC)
  WHERE event_category = 'security';

CREATE OR REPLACE FUNCTION sf_capture_security_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  new_row jsonb := CASE WHEN TG_OP = 'DELETE' THEN '{}'::jsonb ELSE to_jsonb(NEW) END;
  old_row jsonb := CASE WHEN TG_OP = 'INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
  event_action text;
  event_user_id uuid;
  event_org_id uuid;
  event_session_id text;
  event_ip_hash text;
  event_user_agent_hash text;
  event_metadata jsonb := '{}'::jsonb;
  inserted_rows integer := 0;
BEGIN
  IF COALESCE(new_row->>'user_id', old_row->>'user_id', '') <> '' THEN
    event_user_id := COALESCE(new_row->>'user_id', old_row->>'user_id')::uuid;
  ELSIF TG_TABLE_NAME = 'sf_users'
        AND COALESCE(new_row->>'id', old_row->>'id', '') <> '' THEN
    event_user_id := COALESCE(new_row->>'id', old_row->>'id')::uuid;
  END IF;

  IF COALESCE(new_row->>'organization_id', old_row->>'organization_id', '') <> '' THEN
    event_org_id := COALESCE(new_row->>'organization_id', old_row->>'organization_id')::uuid;
  END IF;

  event_session_id := NULLIF(COALESCE(new_row->>'id', old_row->>'id'), '');
  event_ip_hash := NULLIF(COALESCE(new_row->>'ip_hash', old_row->>'ip_hash'), '');
  event_user_agent_hash := NULLIF(COALESCE(new_row->>'user_agent_hash', old_row->>'user_agent_hash'), '');

  IF TG_TABLE_NAME = 'sf_users' AND TG_OP = 'UPDATE' THEN
    IF old_row->>'password_hash' IS DISTINCT FROM new_row->>'password_hash' THEN
      event_action := 'security.password.changed';
    ELSIF old_row->>'last_login_at' IS DISTINCT FROM new_row->>'last_login_at'
          AND NULLIF(new_row->>'last_login_at', '') IS NOT NULL THEN
      event_action := 'security.login.succeeded';
    ELSE
      RETURN NEW;
    END IF;

  ELSIF TG_TABLE_NAME IN ('sf_admin_sessions', 'sf_user_sessions', 'sf_sessions') THEN
    IF TG_OP = 'INSERT' THEN
      event_action := 'security.session.created';
      event_metadata := jsonb_strip_nulls(jsonb_build_object(
        'authSource', new_row->>'auth_source',
        'deviceLabel', new_row->>'device_label',
        'superadminAuthorized', NULLIF(new_row->>'superadmin_authorized', '')::boolean
      ));
    ELSIF TG_OP = 'UPDATE'
          AND old_row->>'revoked_at' IS DISTINCT FROM new_row->>'revoked_at'
          AND NULLIF(new_row->>'revoked_at', '') IS NOT NULL THEN
      event_action := 'security.session.revoked';
      event_metadata := jsonb_strip_nulls(jsonb_build_object(
        'revokedReason', new_row->>'revoked_reason',
        'deviceLabel', new_row->>'device_label'
      ));
    ELSIF TG_OP = 'UPDATE'
          AND old_row->>'superadmin_authorized' IS DISTINCT FROM new_row->>'superadmin_authorized' THEN
      event_action := 'security.session.superadmin_authorization_changed';
      event_metadata := jsonb_strip_nulls(jsonb_build_object(
        'superadminAuthorized', NULLIF(new_row->>'superadmin_authorized', '')::boolean,
        'deviceLabel', new_row->>'device_label'
      ));
    ELSE
      IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
    END IF;

  ELSIF TG_TABLE_NAME IN ('sf_user_passkeys', 'sf_admin_passkeys', 'sf_passkeys') THEN
    IF TG_OP = 'INSERT' THEN
      event_action := 'security.passkey.created';
      event_metadata := jsonb_strip_nulls(jsonb_build_object(
        'name', new_row->>'name',
        'deviceType', new_row->>'device_type',
        'backedUp', NULLIF(new_row->>'backed_up', '')::boolean
      ));
    ELSIF TG_OP = 'DELETE' THEN
      event_action := 'security.passkey.removed';
      event_metadata := jsonb_strip_nulls(jsonb_build_object(
        'name', old_row->>'name'
      ));
    ELSIF TG_OP = 'UPDATE'
          AND old_row->>'last_used_at' IS DISTINCT FROM new_row->>'last_used_at'
          AND NULLIF(new_row->>'last_used_at', '') IS NOT NULL THEN
      event_action := 'security.passkey.used';
      event_metadata := jsonb_strip_nulls(jsonb_build_object(
        'name', new_row->>'name'
      ));
    ELSE
      IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
    END IF;

  ELSIF TG_TABLE_NAME IN ('sf_user_mfa', 'sf_admin_mfa', 'sf_user_two_factor') THEN
    IF TG_OP = 'INSERT' THEN
      event_action := 'security.2fa.configured';
    ELSIF TG_OP = 'DELETE' THEN
      event_action := 'security.2fa.removed';
    ELSIF TG_OP = 'UPDATE'
          AND old_row->>'enabled' IS DISTINCT FROM new_row->>'enabled' THEN
      event_action := CASE
        WHEN COALESCE(new_row->>'enabled', 'false') = 'true'
          THEN 'security.2fa.enabled'
        ELSE 'security.2fa.disabled'
      END;
    ELSIF TG_OP = 'UPDATE'
          AND old_row->>'recovery_code_hashes' IS DISTINCT FROM new_row->>'recovery_code_hashes' THEN
      event_action := 'security.2fa.recovery_codes_changed';
    ELSE
      IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
    END IF;

  ELSE
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  IF event_org_id IS NOT NULL THEN
    INSERT INTO sf_audit_log (
      id, organization_id, user_id, action, entity_type, entity_id,
      metadata, event_category, outcome, source, session_id, actor_role,
      ip_hash, user_agent_hash, created_at
    ) VALUES (
      gen_random_uuid(), event_org_id, event_user_id, event_action,
      CASE
        WHEN TG_TABLE_NAME IN ('sf_admin_sessions', 'sf_user_sessions', 'sf_sessions') THEN 'session'
        WHEN TG_TABLE_NAME IN ('sf_user_passkeys', 'sf_admin_passkeys', 'sf_passkeys') THEN 'passkey'
        WHEN TG_TABLE_NAME IN ('sf_user_mfa', 'sf_admin_mfa', 'sf_user_two_factor') THEN 'mfa'
        ELSE 'user'
      END,
      COALESCE(event_session_id, event_user_id::text), event_metadata,
      'security', 'success', 'database-trigger',
      CASE
        WHEN TG_TABLE_NAME IN ('sf_admin_sessions', 'sf_user_sessions', 'sf_sessions') THEN event_session_id
        ELSE NULL
      END,
      NULL, event_ip_hash, event_user_agent_hash, now()
    );
  ELSIF event_user_id IS NOT NULL THEN
    INSERT INTO sf_audit_log (
      id, organization_id, user_id, action, entity_type, entity_id,
      metadata, event_category, outcome, source, session_id, actor_role,
      ip_hash, user_agent_hash, created_at
    )
    SELECT
      gen_random_uuid(), membership.organization_id, event_user_id, event_action,
      CASE
        WHEN TG_TABLE_NAME IN ('sf_admin_sessions', 'sf_user_sessions', 'sf_sessions') THEN 'session'
        WHEN TG_TABLE_NAME IN ('sf_user_passkeys', 'sf_admin_passkeys', 'sf_passkeys') THEN 'passkey'
        WHEN TG_TABLE_NAME IN ('sf_user_mfa', 'sf_admin_mfa', 'sf_user_two_factor') THEN 'mfa'
        ELSE 'user'
      END,
      COALESCE(event_session_id, event_user_id::text), event_metadata,
      'security', 'success', 'database-trigger',
      CASE
        WHEN TG_TABLE_NAME IN ('sf_admin_sessions', 'sf_user_sessions', 'sf_sessions') THEN event_session_id
        ELSE NULL
      END,
      membership.role, event_ip_hash, event_user_agent_hash, now()
    FROM sf_memberships membership
    WHERE membership.user_id = event_user_id
      AND membership.status = 'active';

    GET DIAGNOSTICS inserted_rows = ROW_COUNT;

    IF inserted_rows = 0 THEN
      INSERT INTO sf_audit_log (
        id, organization_id, user_id, action, entity_type, entity_id,
        metadata, event_category, outcome, source, session_id,
        ip_hash, user_agent_hash, created_at
      ) VALUES (
        gen_random_uuid(), NULL, event_user_id, event_action, 'user',
        event_user_id::text, event_metadata, 'security', 'success',
        'database-trigger',
        CASE
          WHEN TG_TABLE_NAME IN ('sf_admin_sessions', 'sf_user_sessions', 'sf_sessions') THEN event_session_id
          ELSE NULL
        END,
        event_ip_hash, event_user_agent_hash, now()
      );
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

REVOKE ALL ON FUNCTION sf_capture_security_audit() FROM PUBLIC;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'sf_users',
    'sf_admin_sessions',
    'sf_user_sessions',
    'sf_sessions',
    'sf_user_passkeys',
    'sf_admin_passkeys',
    'sf_passkeys',
    'sf_user_mfa',
    'sf_admin_mfa',
    'sf_user_two_factor'
  ]
  LOOP
    IF to_regclass('public.' || table_name) IS NOT NULL THEN
      EXECUTE format(
        'DROP TRIGGER IF EXISTS sf_security_audit_trigger ON %I',
        table_name
      );

      EXECUTE format(
        'CREATE TRIGGER sf_security_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION sf_capture_security_audit()',
        table_name
      );
    END IF;
  END LOOP;
END
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'saborflow_rls_app') THEN
    GRANT SELECT, INSERT ON sf_audit_log TO saborflow_rls_app;
    REVOKE UPDATE, DELETE ON sf_audit_log FROM saborflow_rls_app;

    IF to_regclass('public.sf_platform_admin_actions') IS NOT NULL THEN
      GRANT SELECT, INSERT ON sf_platform_admin_actions TO saborflow_rls_app;
      REVOKE UPDATE, DELETE ON sf_platform_admin_actions FROM saborflow_rls_app;
    END IF;
  END IF;
END
$$;

COMMIT;
