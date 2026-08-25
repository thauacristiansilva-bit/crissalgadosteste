# SaborFlow — Correção Fase 25.7.4: área do cliente / loja pública sem localhost

## Problema corrigido

O atalho **Abrir loja / área do cliente** passava por `/minha-loja`.
Essa rota criava o redirecionamento com `new URL(..., request.url)`.

No Railway, a aplicação pode receber internamente um `request.url` semelhante a `http://localhost:3000`, mesmo quando o usuário chegou pelo domínio público. Por isso o navegador era enviado para o host local.

## Correção

`/minha-loja` agora usa `resolvePublicAppOrigin(request)`.

A prioridade continua:

1. `APP_BASE_URL`;
2. headers `x-forwarded-host` / `x-forwarded-proto`;
3. `RAILWAY_PUBLIC_DOMAIN`;
4. somente fora de produção, origem local de desenvolvimento.

Tanto o redirecionamento para a loja quanto o redirecionamento para `/login` usam a origem pública resolvida.

## Arquivos funcionais

- `app/minha-loja/route.ts`
- `app/api/admin/public-links-health/route.ts`

## Migration

**Não existe migration na Fase 25.7.4.**

## Build no terminal PowerShell do VS Code

```powershell
git restore next-env.d.ts
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run build
```

Se passar:

```powershell
git status --short
```

Stage somente dos arquivos funcionais:

```powershell
git add -- `
"app/minha-loja/route.ts" `
"app/api/admin/public-links-health/route.ts"
```

Confira:

```powershell
git diff --cached --check
git --no-pager diff --cached --name-only
```

Commit e push:

```powershell
git commit -m "Corrigir URL publica da area do cliente"
git push origin main
```

## Validação depois do Railway SUCCESS

Abra autenticado como administrador:

`https://crissalgadosteste-production.up.railway.app/api/admin/public-links-health`

Esperado:

```json
{
  "ok": true,
  "phase": "25.7.4-public-store-origin",
  "publicUrls": {
    "origin": "https://crissalgadosteste-production.up.railway.app",
    "storeUrl": "https://crissalgadosteste-production.up.railway.app/loja/cris-salgados",
    "localOrigin": false
  }
}
```

Depois no Admin clique em **Abrir loja**. A nova aba deve abrir no domínio Railway, nunca em `localhost:3000`.

## Variável Railway

Mantenha no serviço da aplicação:

`APP_BASE_URL=https://crissalgadosteste-production.up.railway.app`

Sem `/` no final.
