BEGIN;

CREATE TABLE IF NOT EXISTS sf_platform_registration_reviews (
  id uuid PRIMARY KEY,
  billing_account_id uuid NOT NULL UNIQUE
    REFERENCES sf_billing_accounts(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  notes text NOT NULL DEFAULT '',
  reviewed_by_platform_admin_id uuid
    REFERENCES sf_platform_admins(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sf_platform_registration_reviews_status_idx
  ON sf_platform_registration_reviews (status, created_at DESC);

-- Contas já existentes entram aprovadas para não interromper clientes legados.
-- Demos e trials técnicos não entram na fila de validação comercial.
INSERT INTO sf_platform_registration_reviews (
  id,
  billing_account_id,
  status,
  notes,
  metadata,
  created_at,
  updated_at
)
SELECT
  md5('saborflow-registration-review:' || ba.id::text)::uuid,
  ba.id,
  'approved',
  'Conta existente antes da validação manual da plataforma.',
  '{"bootstrap":"phase-18-1"}'::jsonb,
  ba.created_at,
  now()
FROM sf_billing_accounts ba
WHERE COALESCE(ba.metadata->>'demo', 'false') <> 'true'
ON CONFLICT (billing_account_id) DO NOTHING;

CREATE OR REPLACE FUNCTION sf_queue_platform_registration_review()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF COALESCE(NEW.metadata->>'demo', 'false') = 'true' THEN
    RETURN NEW;
  END IF;

  INSERT INTO sf_platform_registration_reviews (
    id,
    billing_account_id,
    status,
    metadata
  )
  VALUES (
    md5('saborflow-registration-review:' || NEW.id::text)::uuid,
    NEW.id,
    'pending',
    jsonb_build_object('source', 'automatic-account-registration')
  )
  ON CONFLICT (billing_account_id) DO NOTHING;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS sf_billing_accounts_queue_registration_review
  ON sf_billing_accounts;

CREATE TRIGGER sf_billing_accounts_queue_registration_review
AFTER INSERT ON sf_billing_accounts
FOR EACH ROW
EXECUTE FUNCTION sf_queue_platform_registration_review();

CREATE TABLE IF NOT EXISTS sf_platform_finance_entries (
  id uuid PRIMARY KEY,
  competence_date date NOT NULL,
  entry_type text NOT NULL
    CHECK (entry_type IN ('revenue', 'expense')),
  category text NOT NULL,
  description text NOT NULL,
  counterparty text NOT NULL DEFAULT '',
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  currency text NOT NULL DEFAULT 'BRL',
  status text NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'paid', 'canceled')),
  due_date date,
  paid_at timestamptz,
  notes text NOT NULL DEFAULT '',
  created_by_platform_admin_id uuid NOT NULL
    REFERENCES sf_platform_admins(id) ON DELETE RESTRICT,
  updated_by_platform_admin_id uuid
    REFERENCES sf_platform_admins(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'paid' AND paid_at IS NOT NULL) OR status <> 'paid')
);

CREATE INDEX IF NOT EXISTS sf_platform_finance_entries_competence_idx
  ON sf_platform_finance_entries (competence_date DESC, entry_type, status);

CREATE INDEX IF NOT EXISTS sf_platform_finance_entries_due_idx
  ON sf_platform_finance_entries (status, due_date)
  WHERE status = 'planned';

-- Control plane: estas tabelas não são tenant-scoped e não recebem RLS de organização.
-- Acesso somente por rotas server-side autenticadas em sf_platform_admins.

COMMIT;
