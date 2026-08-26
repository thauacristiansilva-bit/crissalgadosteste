# SaborFlow — Etapa 10: domínios automáticos e Cloudflare for SaaS

## O que esta etapa entrega

1. URL automática por empresa: `https://<slug>.appsaborflow.com.br`.
2. Um único wildcard `*.appsaborflow.com.br` no Railway atende todas as empresas sem cadastrar um domínio Railway por cliente.
3. Domínios próprios de clientes (`pedidos.empresa.com.br`) passam a ser provisionados via Cloudflare for SaaS, com SSL automático.
4. O painel Segurança exibe os registros DNS que o cliente precisa criar e o estado de hostname/SSL.
5. O vínculo do domínio continua protegido pelo TXT `_saborflow`, além da validação do Cloudflare.
6. Um Worker Cloudflare encaminha domínios externos ao Railway e preserva o hostname original por um cabeçalho autenticado.

Não há migration de banco e não há dependência npm nova.

---

## Por que não cadastrar cada domínio no Railway

No plano Hobby, o Railway aceita 2 custom domains por serviço. Use os dois slots para:

- `appsaborflow.com.br`
- `*.appsaborflow.com.br`

Os domínios próprios dos clientes ficam no Cloudflare for SaaS, evitando consumir um domínio Railway por empresa.

---

# PARTE A — Aplicar os arquivos no projeto

Extraia este ZIP na raiz do projeto, permitindo substituir os arquivos existentes.

Depois rode no terminal, sem usar `git add .`:

```powershell
git status
git add .env.example
git add app/page.tsx
git add app/cardapio/page.tsx
git add app/pedir/page.tsx
git add components/admin/security-panel.tsx
git add lib/cloudflare-saas.ts
git add lib/organization-db.ts
git add lib/organization-security-db.ts
git add lib/public-host.ts
git add cloudflare/saborflow-edge-worker.js
git add LEIA-ME-ETAPA-10.md
git commit -m "Etapa 10 - dominios automaticos com Cloudflare for SaaS"
git push origin main
```

Aguarde o deploy do `crissalgadosteste` ficar **Active**.

---

# PARTE B — Railway: wildcard da plataforma

Em `crissalgadosteste → Settings → Networking → Public Networking`:

1. Mantenha `appsaborflow.com.br`.
2. Adicione o segundo e último custom domain do Hobby: `*.appsaborflow.com.br`.
3. O Railway exibirá os registros de DNS/validação. Copie exatamente para o Cloudflare.
4. No Cloudflare, o `_acme-challenge` fornecido pelo Railway deve ficar **DNS only** (nuvem cinza).
5. Aguarde o wildcard ficar verificado/ativo no Railway.

O wildcard passa a atender automaticamente, por exemplo:

- `cris-salgados.appsaborflow.com.br`
- `empresa-a.appsaborflow.com.br`
- `empresa-b.appsaborflow.com.br`

O slug da empresa é usado para encontrar o tenant correto.

---

# PARTE C — Cloudflare for SaaS

No Cloudflare, abra a zona `appsaborflow.com.br` e habilite **Cloudflare for SaaS / Custom Hostnames**.

## 1. Fallback origin

Crie um registro DNS:

```text
Tipo: AAAA
Nome: fallback
Valor: 100::
Proxy: Proxied (nuvem laranja)
```

Depois, em **Custom Hostnames**, defina:

```text
Fallback Origin: fallback.appsaborflow.com.br
```

Espere o status ficar **Active**.

## 2. CNAME amigável dos clientes

Crie:

```text
Tipo: CNAME
Nome: customers
Destino: fallback.appsaborflow.com.br
Proxy: Proxied
```

Os clientes apontarão seus domínios para:

```text
customers.appsaborflow.com.br
```

## 3. Origin real do SaborFlow

Crie `origin.appsaborflow.com.br` apontando para o mesmo CNAME/target que o Railway mostrou para `*.appsaborflow.com.br`.

Esse hostname é coberto pelo wildcard do Railway; não o adicione como terceiro custom domain no Railway.

---

# PARTE D — Criar o Worker Cloudflare

No Cloudflare, crie um Worker chamado, por exemplo:

```text
saborflow-custom-domain-edge
```

Cole o conteúdo de:

```text
cloudflare/saborflow-edge-worker.js
```

No Worker, configure:

```text
SABORFLOW_ORIGIN_HOST=origin.appsaborflow.com.br
```

Crie também um segredo chamado:

```text
SABORFLOW_EDGE_TOKEN
```

Gere um valor aleatório no seu computador:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Não envie esse valor para ninguém. Salve o **mesmo valor** no Worker e no Railway.

## Rotas do Worker

Na zona `appsaborflow.com.br`, configure:

```text
*/*                         → saborflow-custom-domain-edge
*.appsaborflow.com.br/*     → None / sem Worker
appsaborflow.com.br/*       → None / sem Worker
```

A rota geral captura os domínios externos cadastrados no Cloudflare for SaaS. As duas rotas mais específicas impedem o Worker de interceptar os domínios normais da própria plataforma e também evitam recursão quando ele chama `origin.appsaborflow.com.br`.

---

# PARTE E — Token da API Cloudflare

Crie um API Token separado e restrito à zona `appsaborflow.com.br` com permissão para **SSL and Certificates: Edit/Write**.

Nunca use Global API Key e não reutilize as credenciais do R2.

Copie também o **Zone ID** de `appsaborflow.com.br`. Atenção: Zone ID é diferente do Account ID.

---

# PARTE F — Variáveis no Railway

Em `crissalgadosteste → Variables`, adicione:

```text
STOREFRONT_ROOT_DOMAIN=appsaborflow.com.br
NEXT_PUBLIC_STOREFRONT_ROOT_DOMAIN=appsaborflow.com.br
STOREFRONT_RESERVED_SUBDOMAINS=www,painel,media,api,admin,origin,customers,fallback

CLOUDFLARE_ZONE_ID=<ZONE ID DA ZONA appsaborflow.com.br>
CLOUDFLARE_SAAS_API_TOKEN=<TOKEN PRIVADO>
CLOUDFLARE_SAAS_CNAME_TARGET=customers.appsaborflow.com.br

SABORFLOW_EDGE_TOKEN=<MESMO SEGREDO CONFIGURADO NO WORKER>
```

Depois faça um redeploy do `crissalgadosteste`.

Não coloque `CLOUDFLARE_SAAS_API_TOKEN` nem `SABORFLOW_EDGE_TOKEN` no GitHub.

---

# PARTE G — Teste 1: subdomínio automático

Pegue o slug de uma empresa. Para a Cris Salgados, se o slug continuar `cris-salgados`, teste:

```text
https://cris-salgados.appsaborflow.com.br
https://cris-salgados.appsaborflow.com.br/cardapio
https://cris-salgados.appsaborflow.com.br/pedir
```

As três URLs devem abrir a mesma empresa sem cadastrar `cris-salgados.appsaborflow.com.br` individualmente no Railway.

---

# PARTE H — Teste 2: domínio próprio de cliente

No painel da empresa:

```text
Admin → Segurança → Domínio customizado
```

Informe algo como:

```text
pedidos.seu-dominio-de-teste.com.br
```

O SaborFlow deve mostrar:

1. TXT `_saborflow` para comprovar que aquela empresa controla o domínio.
2. CNAME do tráfego apontando para `customers.appsaborflow.com.br`.
3. Se exigidos pelo Cloudflare, TXT/CNAME adicionais para hostname e certificado SSL.

Crie todos os registros no DNS do domínio do cliente. Se o DNS dele também estiver no Cloudflare, use **DNS only** no CNAME que aponta para `customers.appsaborflow.com.br` durante a validação inicial.

Depois clique em **Verificar** novamente. Quando o Cloudflare informar hostname e SSL como `active`, o domínio está pronto.

---

# Resultado esperado

```text
Empresa A → empresa-a.appsaborflow.com.br
Empresa B → empresa-b.appsaborflow.com.br
Empresa C → empresa-c.appsaborflow.com.br

Cliente com domínio próprio:
pedidos.empresa.com.br → Cloudflare for SaaS → Worker → origin.appsaborflow.com.br → Railway → tenant correto
```

Com isso, novos clientes não consomem um custom domain Railway cada um.
