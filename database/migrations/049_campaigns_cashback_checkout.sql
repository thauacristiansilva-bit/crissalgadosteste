BEGIN;

-- Cashback usado no checkout: mantém o desconto separado do cupom e da entrega.
ALTER TABLE sf_orders
  ADD COLUMN IF NOT EXISTS cashback_redeemed_points integer NOT NULL DEFAULT 0
    CHECK (cashback_redeemed_points >= 0),
  ADD COLUMN IF NOT EXISTS cashback_discount numeric(12, 2) NOT NULL DEFAULT 0
    CHECK (cashback_discount >= 0),
  ADD COLUMN IF NOT EXISTS cashback_refunded_at timestamptz;

-- Um pedido pode debitar cashback somente uma vez.
CREATE UNIQUE INDEX IF NOT EXISTS sf_loyalty_ledger_order_redeem_unique
  ON sf_loyalty_ledger (organization_id, order_id, kind)
  WHERE order_id IS NOT NULL AND kind = 'redeem';

-- A Central de Comunicação passa a segmentar clientes da loja, e não o plano
-- comercial do próprio SaborFlow. Mantemos os valores antigos para não quebrar
-- campanhas já salvas antes desta migração.
ALTER TABLE sf_communication_campaigns
  DROP CONSTRAINT IF EXISTS sf_communication_campaigns_audience_check;

ALTER TABLE sf_communication_campaigns
  ADD CONSTRAINT sf_communication_campaigns_audience_check
  CHECK (audience IN (
    'all', 'new', 'repeat', 'frequent', 'elite',
    'active', 'sleeping', 'inactive', 'never',
    'trial', 'monthly', 'semiannual', 'annual'
  ));

COMMIT;
