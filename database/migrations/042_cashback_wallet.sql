BEGIN;

ALTER TABLE sf_customer_accounts
  ADD COLUMN IF NOT EXISTS cashback_cents integer NOT NULL DEFAULT 0 CHECK (cashback_cents >= 0);
ALTER TABLE sf_orders
  ADD COLUMN IF NOT EXISTS cashback_used_cents integer NOT NULL DEFAULT 0 CHECK (cashback_used_cents >= 0);

CREATE TABLE IF NOT EXISTS sf_cashback_ledger (
  organization_id uuid NOT NULL REFERENCES sf_organizations(id) ON DELETE CASCADE,
  customer_id integer NOT NULL,
  order_id integer NOT NULL,
  kind text NOT NULL CHECK (kind IN ('earn', 'redeem', 'refund', 'reversal')),
  amount_cents integer NOT NULL CHECK (amount_cents <> 0),
  balance_after_cents integer NOT NULL CHECK (balance_after_cents >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, order_id, kind),
  FOREIGN KEY (organization_id, customer_id) REFERENCES sf_customer_accounts (organization_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, order_id) REFERENCES sf_orders (organization_id, id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS sf_cashback_ledger_customer_idx
  ON sf_cashback_ledger (organization_id, customer_id, created_at DESC);

-- Política preparada; ativação do RLS acompanha a implantação geral do projeto.
ALTER TABLE sf_cashback_ledger DISABLE ROW LEVEL SECURITY;
CREATE POLICY sf_cashback_ledger_tenant_scope ON sf_cashback_ledger
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK (organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid);

COMMIT;
