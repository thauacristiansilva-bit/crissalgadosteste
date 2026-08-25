# SaborFlow — Correção Fase 16.1

Corrige o narrowing TypeScript de `AdminSession` em `lib/auth.ts`.

Erro corrigido:

```text
lib/auth.ts: Property 'organizationId' does not exist on type 'AdminSession'
```

A correção exige explicitamente `tenantSession.mode === "tenant"` antes de acessar `organizationId`.

## Instalação

Extraia na raiz do projeto substituindo `lib/auth.ts`.

```powershell
git restore next-env.d.ts
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run build
```

Se o build passar:

```powershell
git add lib/auth.ts
git diff --cached --check
git --no-pager diff --cached --name-only
git commit -m "Corrigir sessao tenant da demo"
git push origin main
```

A migration 016 só deve ser executada depois que o novo deploy estiver SUCCESS.
