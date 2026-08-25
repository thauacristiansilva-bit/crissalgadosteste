# SaborFlow — Fase 16: Demo pública e trial individual

## Objetivo

A Fase 16 cria ambientes reais, isolados e temporários usando a arquitetura multiempresa PostgreSQL.

- **Demo pública:** ambiente exclusivo por visitante, padrão de 45 minutos.
- **Trial individual:** ambiente exclusivo vinculado ao usuário comercial, padrão de 7 dias.
- Ambos usam dados fictícios e permitem simular pedidos, PDV, cozinha, entrega, caixa, clientes, cupons, financeiro, complementos e estoque.
- Domínio customizado, impressão externa, emissão fiscal e integrações com efeitos externos ficam bloqueados.
- A expiração é validada no servidor; token antigo não mantém acesso após o prazo.

## Migration

`database/migrations/016_demo_trials.sql`

Cria:

- `sf_demo_environments`
- plano interno `demo-sandbox`
- limites pequenos de usuários/produtos e todos os recursos operacionais necessários para simulação
- RLS preparado, ainda sem enforcement

## Instalação

Depois de extrair na raiz:

```powershell
git restore next-env.d.ts
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run build
git status --short
```

Não faça `git add .`.

Aguarde a conferência dos arquivos antes do commit.

## Depois do deploy

No Railway:

```bash
node scripts/migrate-multiempresa.mjs
```

Esperado:

```text
APLICANDO 016_demo_trials...
OK 016_demo_trials
```

## Testes

Página da demo:

`/demo`

Health da Fase 16, já logado:

`/api/admin/demo-health`

Billing health:

`/api/admin/billing-health`

### Demo pública

1. Abra `/demo`.
2. Clique **Abrir demonstração**.
3. O sistema cria uma organização isolada e entra no Admin.
4. Abra a loja pública pelo atalho do painel.
5. Faça um pedido.
6. Confirme o pedido no Admin, mova para cozinha, pronto, em rota e concluído.
7. Teste caixa, clientes, cupons, estoque e complementos.

### Segurança

Em uma demo, tente:

- cadastrar domínio;
- criar agente de impressão;
- ativar impressão automática ou emissão fiscal.

Todas devem ser recusadas pelo backend.

## Expiração

A expiração lógica é sempre aplicada pelo servidor quando o ambiente é acessado. Para limpeza periódica antecipada, existe também:

```bash
node scripts/expire-demos.mjs
```

Esse script pode futuramente ser colocado em um Railway Cron. Mesmo sem o cron, uma demo vencida não continua acessível.
