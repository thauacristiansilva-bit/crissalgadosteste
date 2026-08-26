# Hotfix do teste de carga - rotas da loja

O primeiro teste usou `/`, `/cardapio` e `/pedir` no domínio principal.
No domínio compartilhado do SaborFlow, as rotas públicas de uma empresa são:

- `/loja/SEU-SLUG/`
- `/loja/SEU-SLUG/cardapio`
- `/loja/SEU-SLUG/pedir`

Este hotfix adiciona a variável `STOREFRONT_BASE_PATH` e um preflight que testa as três páginas antes de iniciar a carga.

## Git

```powershell
git add loadtest/loadtest.js
git add LEIA-ME-HOTFIX-TESTE-CARGA.md
git commit -m "Hotfix - corrige rotas do teste de carga"
git push origin main
```

## Railway

No serviço `saborflow-loadtest`, mantenha:

```text
TARGET_URL=https://appsaborflow.com.br
LOAD_VUS=25
LOAD_DURATION=2m
THINK_MIN_MS=500
THINK_MAX_MS=1500
RAILWAY_DOCKERFILE_PATH=loadtest/Dockerfile
```

Adicione:

```text
STOREFRONT_BASE_PATH=/loja/SEU-SLUG
```

Copie o slug da URL pública real da empresa. Exemplo: se a loja abre em
`https://appsaborflow.com.br/loja/minha-loja`, use `/loja/minha-loja`.

Se a empresa estiver em um domínio/subdomínio próprio que já resolve `/`, `/cardapio` e `/pedir`, deixe `STOREFRONT_BASE_PATH` vazio e use esse domínio em `TARGET_URL`.

Não avance para 50 VUs até o teste de 25 passar com menos de 1% de erros.
