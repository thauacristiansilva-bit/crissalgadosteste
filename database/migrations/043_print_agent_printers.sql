BEGIN;
ALTER TABLE sf_print_agents ADD COLUMN IF NOT EXISTS available_printers jsonb NOT NULL DEFAULT '[]'::jsonb;
CREATE UNIQUE INDEX IF NOT EXISTS sf_meta_phone_connection_unique ON sf_integration_connections ((settings->>'metaPhoneId'))
  WHERE provider = 'whatsapp_meta' AND settings ? 'metaPhoneId';
COMMIT;
