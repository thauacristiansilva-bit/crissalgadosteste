# Etapa 8 — Performance, Storage e preparação para escala

Esta etapa não envolve IA e não altera o schema do PostgreSQL.

## Objetivos

1. Tirar novos uploads do disco/Volume quando o Cloudflare R2 estiver ativado.
2. Migrar imagens antigas para o R2 pelo próprio painel administrativo.
3. Manter compatibilidade com URLs antigas `/api/media/...` durante a migração.
4. Reduzir carga repetitiva do cardápio público com cache curto por tenant.
5. Reduzir o polling pesado do dashboard sem perder atualização rápida de pedidos.
6. Tornar o pool PostgreSQL configurável por réplica.
7. Criar um endpoint `/api/health` para o Healthcheck do Railway.

## Cloudflare R2

O código usa a API S3 compatível do R2 diretamente, sem dependência npm adicional.

Novos uploads usam a estrutura:

- `organizations/<organizationId>/products/...`
- `organizations/<organizationId>/brand/...`

Arquivos antigos são migrados para:

- `legacy/<nome-do-arquivo>`

### Variáveis do Railway

```env
MEDIA_STORAGE_MODE=r2
R2_ACCOUNT_ID=
R2_BUCKET_NAME=saborflow-media
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_PUBLIC_BASE_URL=https://media.saborflow.com.br
```

`R2_ENDPOINT` é opcional. Se não informado, o SaborFlow usa:

```text
https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com
```

## Migração das imagens existentes

Depois de ativar o R2, acesse:

```text
Admin → Segurança da conta → Storage e CDN
```

O painel mostra a quantidade de arquivos locais encontrados.

Clique em **Migrar próximo lote de imagens**. Cada lote verifica os objetos no R2, envia os que faltam e remove a cópia local somente depois da confirmação do objeto remoto.

A rota antiga `/api/media/<arquivo>` também faz migração automática na primeira leitura, caso o arquivo ainda esteja local.

**Não remova o Volume do Railway antes de o painel mostrar zero arquivos locais e você testar as imagens da loja.**

## Cache do cardápio

O snapshot público de produtos, categorias, configurações e áreas de entrega fica em cache curto em memória por réplica.

Padrão:

```env
PUBLIC_STORE_CACHE_TTL_MS=15000
```

Isso significa no máximo cerca de 15 segundos de defasagem visual no cardápio. O checkout continua validando preço, disponibilidade, estoque e regras diretamente no backend no momento do pedido.

Use `0` para desativar o cache.

## Dashboard

Antes, o dashboard completo era buscado a cada 5 segundos.

Agora:

- pedidos recentes usam `/api/dashboard/live`;
- áreas de pedidos/cozinha/visão geral atualizam em intervalo curto;
- outras áreas usam intervalo mais leve;
- snapshot completo é sincronizado em intervalo maior;
- abas em segundo plano deixam de disparar polling desnecessário;
- ao voltar para a janela, ocorre atualização imediata.

## PostgreSQL

Pool configurável por réplica:

```env
POSTGRES_POOL_MAX=5
POSTGRES_IDLE_TIMEOUT_MS=30000
POSTGRES_CONNECT_TIMEOUT_MS=5000
```

Considere o total de réplicas. Exemplo: 3 réplicas com pool 5 podem abrir até aproximadamente 15 conexões do aplicativo simultaneamente, além de outras conexões administrativas/serviços.

## Railway Healthcheck

Foi criada a rota:

```text
/api/health
```

No Railway, configure o Healthcheck Path para `/api/health` depois do deploy.

## Réplicas

Não aumente réplicas enquanto o serviço ainda depender do Volume para imagens.

Fluxo recomendado:

1. Ativar R2.
2. Migrar imagens antigas.
3. Confirmar que o painel mostra zero arquivos locais.
4. Testar logo, capa, galeria e produtos.
5. Remover o Volume do serviço.
6. Fazer novo deploy.
7. Só depois testar 2 réplicas e realizar teste de carga na etapa seguinte.

## O que não muda

- pedidos;
- checkout;
- login Google;
- CPF/CNPJ;
- RLS;
- termos/LGPD;
- aceite automático/manual;
- acompanhamento de pedidos;
- Mercado Pago.

## Sem migration

A Etapa 8 não exige SQL nem migration.
