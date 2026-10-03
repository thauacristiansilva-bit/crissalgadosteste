# ETAPA 12C — Publicação automática Instagram / Meta

Esta etapa continua a ETAPA 12 já instalada.

## O que entra

- conexão de conta profissional do Instagram usando OAuth da Meta;
- token da conta armazenado criptografado no banco;
- publicação automática de imagens no Instagram Feed;
- publicação automática de imagens em Instagram Story quando a conta/Meta permitir;
- processamento dos posts `scheduled` da ETAPA 12;
- tentativas automáticas em caso de falha;
- após 5 falhas consecutivas, o post muda para `failed`;
- recorrência diária/semanal continua funcionando;
- Status do WhatsApp permanece assistido, sem automação não oficial;
- tela de Marketing mostra se o Instagram está conectado.

## Antes de aplicar

A ETAPA 12 precisa estar instalada e funcionando.

## Aplicar

Extraia este ZIP na raiz do Sabor Flow.

```powershell
node APLICAR-ETAPA-12C-PUBLICACAO-AUTOMATICA-META.js
node APLICAR-MIGRATION-ETAPA-12C.cjs
npm run build
```

Se o build passar:

```powershell
git add .
git commit -m "Etapa 12C - publicacao automatica Instagram Meta"
git push origin main
```

## Variáveis no Railway — serviço principal

Configure:

```text
META_APP_ID=SEU_APP_ID
META_APP_SECRET=SEU_APP_SECRET
META_GRAPH_VERSION=v25.0
META_TOKEN_ENCRYPTION_KEY=UMA_CHAVE_FORTE_E_ALEATORIA
META_OAUTH_STATE_SECRET=OUTRA_CHAVE_FORTE_E_ALEATORIA
APP_PUBLIC_URL=https://SEU-DOMINIO
CRON_SECRET=OUTRA_CHAVE_FORTE_E_ALEATORIA
MARKETING_TIMEZONE_OFFSET_MINUTES=-180
```

`META_INSTAGRAM_REDIRECT_URI` é opcional. Se não for definido, o sistema usa:

```text
https://SEU-DOMINIO/api/meta/instagram/callback
```

Essa mesma URL precisa estar cadastrada no aplicativo da Meta como redirect URI.

## Meta Developer

No aplicativo da Meta, a integração precisa permitir as permissões necessárias para Instagram profissional, incluindo publicação de conteúdo.

No fluxo implementado nesta etapa são solicitadas:

- `pages_show_list`
- `pages_read_engagement`
- `instagram_basic`
- `instagram_content_publish`

A conta do Instagram deve ser profissional e estar ligada a uma Página compatível com esse fluxo.

## Cron no Railway

O Railway Cron executa no mínimo a cada 5 minutos.

Crie um SEGUNDO serviço no mesmo projeto, apontando para o mesmo repositório.

Start Command:

```text
node scripts/process-marketing-publications.cjs
```

Cron Schedule:

```text
*/5 * * * *
```

No serviço de cron, configure apenas:

```text
APP_PUBLIC_URL=https://SEU-DOMINIO
CRON_SECRET=O_MESMO_CRON_SECRET_DO_SERVICO_PRINCIPAL
```

O serviço executa, chama a rota protegida, publica o que estiver vencido e encerra.

## Observações

1. A imagem precisa estar disponível publicamente por HTTPS para a Meta buscá-la.
2. A ETAPA 12 já entrega a arte por uma rota pública de asset.
3. Esta etapa automatiza imagens de Feed e Story.
4. Vídeos/Reels ficam para uma extensão posterior.
5. O Status do WhatsApp não é automatizado por meios não oficiais.
6. Se uma autorização Meta expirar ou for revogada, o painel pede reconexão.
