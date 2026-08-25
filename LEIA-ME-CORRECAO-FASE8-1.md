# SaborFlow — Fase 8.1 — Correção do build

Erro corrigido:

`app/api/coupons/route.ts`
`isTenantOperationsReady is defined multiple times`

A importação duplicada foi removida.

## Aplicar

Copie:

`app/api/coupons/route.ts`

para o mesmo caminho no projeto, substituindo o arquivo atual.

Depois:

```powershell
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run build
```

Se o build passar:

```powershell
git add app/api/coupons/route.ts
git commit -m "Corrigir import duplicado da Fase 8 SaborFlow"
git push origin main
```

Os três avisos de filesystem do Turbopack não são a causa desta falha.
