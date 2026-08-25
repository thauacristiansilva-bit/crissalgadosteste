# SaborFlow

SaborFlow é uma plataforma SaaS multiempresa para pedidos, cardápio digital, PDV, cozinha, estoque, clientes, financeiro, marketing, entregas e gestão.

A aplicação usa **Next.js 16 + React 19 + PostgreSQL** e mantém os dados operacionais separados por organização/empresa.

## Principais áreas

### Loja do cliente
- Cardápio online com busca, categorias, complementos e carrinho.
- Delivery, retirada e agendamento.
- Cálculo de entrega e endereço com Google Maps.
- PIX, dinheiro, cartão, cupons e observações.
- Conta opcional de cliente, fidelidade e acompanhamento do pedido.
- Informações da loja, redes sociais, horários e atendimento rápido.

### Painel administrativo
- Visão geral e indicadores.
- Pedidos, PDV e cozinha/KDS.
- Caixa, financeiro e DRE.
- Produtos, categorias e estoque.
- Clientes, CRM, fidelidade, avaliações, cupons e campanhas.
- QR Codes e links públicos.
- Equipe, funções e permissões.
- Integrações, grupo empresarial, relatórios e operação alimentar.
- Plano, cobrança e Mercado Pago.
- Domínios personalizados e estrutura multiempresa.

## Requisitos locais

- Node.js 22 recomendado.
- npm.
- PostgreSQL acessível pela variável `DATABASE_URL`.

## Instalação local

Na pasta que contém `package.json`:

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

No CMD, use:

```bat
npm ci
copy .env.example .env.local
npm run dev
```

Depois abra `http://localhost:3000`.

## Variáveis de ambiente

Use `.env.example` como referência. Para a aplicação principal, mantenha pelo menos:

```env
DATABASE_URL=
SESSION_SECRET=
CLIENT_SESSION_SECRET=
APP_BASE_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Google Maps, Mercado Pago, integrações e recursos de demonstração possuem variáveis opcionais próprias no `.env.example`.

Nunca envie `.env`, `.env.local`, tokens ou chaves privadas para o Git.

## Validação antes do deploy

```powershell
npm run typecheck
npm run build
```

Se ambos concluírem sem erro, faça o commit.

## Git + Railway

Se o projeto do GitHub já estiver conectado ao Railway, normalmente basta enviar o commit:

```powershell
git status
git add .
git commit -m "Etapa 1 - reorganiza interface e textos do SaborFlow"
git push origin main
```

O Railway detecta o push e inicia o deploy automaticamente.

Se a branch conectada no Railway tiver outro nome, substitua `main` pelo nome correto.

## Railway

No serviço web, confira principalmente:

```env
DATABASE_URL=...
SESSION_SECRET=...
CLIENT_SESSION_SECRET=...
APP_BASE_URL=https://SEU-DOMINIO
NEXT_PUBLIC_APP_URL=https://SEU-DOMINIO
```

O domínio `*.up.railway.app` pode ser fornecido automaticamente pelo Railway através de `RAILWAY_PUBLIC_DOMAIN`.

### Imagens

Na arquitetura atual, uploads podem usar `UPLOAD_DIR` em um Volume do Railway:

```env
UPLOAD_DIR=/data/uploads
```

Enquanto as imagens dependerem desse Volume no mesmo serviço web, mantenha a aplicação em uma única réplica. A migração das imagens para storage/CDN externo será tratada em uma etapa posterior de escalabilidade.

## Banco de dados

A aplicação atual usa PostgreSQL como fonte principal para autenticação, organizações e módulos operacionais modernos. Alguns scripts antigos de importação ainda aceitam `ADMIN_EMAIL`, `ADMIN_PASSWORD` e `DATA_FILE` apenas para migração/bootstrap de versões anteriores; eles não devem ser tratados como o modelo principal de autenticação da aplicação.

## Etapa 1 de reorganização

Esta versão reorganiza a navegação administrativa, melhora nomes e mensagens da interface, limpa elementos desnecessários da loja pública e mantém as rotas, permissões e estrutura de banco existentes.

Não há migration nova nem dependência npm nova nesta etapa.
