# SaborFlow — Correção Fase 16.2

Corrige a validação same-origin da demo quando a aplicação está atrás do reverse proxy do Railway.

A proteção de origem continua ativa. A validação passa a reconhecer a origem pública informada por `x-forwarded-host` + `x-forwarded-proto`, além de `APP_BASE_URL` quando configurado.

## Instalação

Extraia na raiz do projeto e substitua `lib/demo-request.ts`.

```powershell
git restore next-env.d.ts
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run build
```

Se passar:

```powershell
git add lib/demo-request.ts
git diff --cached --check
git --no-pager diff --cached --name-only
git commit -m "Corrigir origem da demo no Railway"
git push origin main
```

Não há migration nesta correção.
