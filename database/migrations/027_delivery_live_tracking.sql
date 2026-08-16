-- SaborFlow — FASE 25.4/25.5
-- Navegação do entregador + rastreamento ao vivo com privacidade por entrega ativa.
-- Não cria nova tabela tenant: amplia sf_couriers, que já está coberta pelo RLS definitivo.

ALTER TABLE sf_couriers
  ADD COLUMN IF NOT EXISTS active_order_id integer,
  ADD COLUMN IF NOT EXISTS current_latitude double precision,
  ADD COLUMN IF NOT EXISTS current_longitude double precision,
  ADD COLUMN IF NOT EXISTS location_accuracy_meters double precision,
  ADD COLUMN IF NOT EXISTS location_updated_at timestamptz;

-- Preserva uma entrega que já estivesse em rota antes desta migration como
-- entrega ativa do entregador. Em caso de dado legado inconsistente com mais
-- de uma entrega em rota, usa a mais antiga e não expõe GPS para as demais.
WITH active AS (
  SELECT DISTINCT ON (organization_id, courier_id)
    organization_id,
    courier_id,
    id AS order_id
  FROM sf_orders
  WHERE type = 'delivery'
    AND status = 'in-route'
    AND courier_id IS NOT NULL
  ORDER BY organization_id, courier_id, updated_at ASC, id ASC
)
UPDATE sf_couriers c
SET active_order_id = active.order_id
FROM active
WHERE c.organization_id = active.organization_id
  AND c.id = active.courier_id
  AND c.active_order_id IS NULL;

-- Dados fora de faixa nunca devem sobreviver à persistência.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sf_couriers_live_latitude_check'
  ) THEN
    ALTER TABLE sf_couriers
      ADD CONSTRAINT sf_couriers_live_latitude_check
      CHECK (current_latitude IS NULL OR current_latitude BETWEEN -90 AND 90);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sf_couriers_live_longitude_check'
  ) THEN
    ALTER TABLE sf_couriers
      ADD CONSTRAINT sf_couriers_live_longitude_check
      CHECK (current_longitude IS NULL OR current_longitude BETWEEN -180 AND 180);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sf_couriers_live_accuracy_check'
  ) THEN
    ALTER TABLE sf_couriers
      ADD CONSTRAINT sf_couriers_live_accuracy_check
      CHECK (location_accuracy_meters IS NULL OR location_accuracy_meters >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sf_couriers_active_order
  ON sf_couriers (organization_id, active_order_id)
  WHERE active_order_id IS NOT NULL;

-- Reafirma a proteção já existente. Não altera a contagem de tabelas RLS.
ALTER TABLE sf_couriers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sf_couriers FORCE ROW LEVEL SECURITY;
