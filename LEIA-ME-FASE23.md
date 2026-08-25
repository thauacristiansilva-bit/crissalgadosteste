# SaborFlow — FASE 23 — Integrações

Esta fase adiciona a infraestrutura segura de integrações externas do SaborFlow sem antecipar o RLS definitivo da FASE 24.

## O que entra

- Área administrativa `/admin/integracoes` para owner/admin.
- Entitlement comercial `integrations`.
- Conexões com credenciais criptografadas em AES-256-GCM.
- Adaptadores server-side para Resend (e-mail), Twilio (SMS), Meta WhatsApp Cloud API por template e webhook HTTPS assinado.
- Fila `outbox` idempotente com tentativas, retry/backoff e histórico.
- Campanhas da FASE 21 podem ser enfileiradas somente para clientes com consentimento ativo.
- O worker revalida assinatura/entitlement e consentimento antes do efeito externo.
- Endpoint interno do worker protegido por `INTEGRATION_WORKER_TOKEN`.
- Webhook genérico de entrada com HMAC SHA-256 e idempotência de evento; nesta fase ele apenas registra o evento e não aplica efeitos de negócio automaticamente.
- Webhooks de saída exigem HTTPS e host presente em `INTEGRATION_WEBHOOK_ALLOWED_HOSTS`.
- Demos continuam bloqueadas para efeitos externos reais.
- RLS das novas tabelas é preparado, mas permanece desligado até a FASE 24.

## Migration

`database/migrations/022_integrations.sql`

Tabelas:

- `sf_integration_connections`
- `sf_integration_outbox`
- `sf_integration_attempts`
- `sf_integration_webhook_events`

## Variáveis de ambiente

A estrutura funciona sem provedores configurados, mas o disparo externo só fica pronto depois destas variáveis:

- `INTEGRATION_ENCRYPTION_KEY`: 32 bytes em Base64 ou 64 caracteres hexadecimais.
- `INTEGRATION_WORKER_TOKEN`: token forte usado somente pelo worker.
- `INTEGRATION_WEBHOOK_ALLOWED_HOSTS`: lista separada por vírgulas dos hosts permitidos para webhooks de saída. Só é necessária para conexões `webhook`.
- `INTEGRATION_CAMPAIGN_MAX_RECIPIENTS`: opcional; padrão 500, limite máximo 5000.
- `INTEGRATION_WORKER_BATCH`: opcional; padrão 20, máximo 50 no script do worker.
- `APP_BASE_URL`: já usada no SaaS e necessária para `scripts/process-integrations-worker.mjs`.

Para gerar valores fortes localmente:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Use um valor diferente para cada segredo.

## Worker

O navegador só enfileira. O envio real acontece no backend.

Uma execução manual do worker pode ser feita com:

```bash
node scripts/process-integrations-worker.mjs
```

Depois, a mesma execução pode ser colocada em um job/cron do ambiente de produção.

## Webhook genérico

URL pública de entrada:

`/api/integrations/webhooks/{connectionId}`

Headers esperados:

- `x-saborflow-signature: sha256=<hmac do corpo bruto>`
- `x-saborflow-event-id: <id único do evento>` (opcional; se ausente, o hash do corpo vira a chave idempotente)
- `x-saborflow-event-type: <tipo>` (opcional)

O segredo HMAC é o mesmo salvo na conexão webhook e nunca volta para o navegador.

## Ordem de instalação

1. Extrair o ZIP na raiz.
2. Restaurar `next-env.d.ts` se o Next o tiver alterado.
3. Rodar `npm run build`.
4. Conferir `git status --short`.
5. Fazer stage somente dos arquivos funcionais indicados no chat.
6. Commit/push e aguardar Railway `SUCCESS`.
7. Rodar `node scripts/migrate-multiempresa.mjs` para aplicar a `022`.
8. Validar `/api/admin/integrations-health`.
9. Configurar os segredos do worker antes de ativar conexões reais.

## Health esperado após migration, antes dos segredos

É normal a estrutura responder `ok: true` e ao mesmo tempo mostrar:

- `encryptionKeyConfigured: false`
- `workerTokenConfigured: false`
- `dispatchReady: false`

Esses campos indicam apenas que a infraestrutura foi instalada, mas efeitos externos reais ainda não foram habilitados.
