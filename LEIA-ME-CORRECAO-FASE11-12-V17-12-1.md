# SaborFlow — Correção Fases 11/12 — v17.12.1

Esta correção resolve o build com:

- `Module not found: Can\'t resolve '@/lib/admin-access'`
- `Export zonedDateString doesn\'t exist in target module`
- `Export zonedDateTime doesn\'t exist in target module`

## Causa

As Fases 11/12 foram preparadas sobre a Fase 10 corrigida v17.10.1. No projeto em teste, `lib/admin-access.ts` ficou ausente e `lib/operations.ts` ficou numa revisão anterior.

## Instalação

1. Extraia este ZIP na raiz do projeto:
   `C:\Users\thaua\Downloads\cris-salgados-agendamento-entrega-pronto`
2. Permita substituir `lib/operations.ts`.
3. O arquivo `lib/admin-access.ts` será criado/restaurado.
4. Não faça commit ainda. Primeiro rode:

```powershell
git restore next-env.d.ts
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run build
```

## Resultado esperado

Os 7 erros atuais ligados a `admin-access`, `zonedDateString` e `zonedDateTime` devem desaparecer. Os warnings conhecidos do Turbopack sobre filesystem podem continuar aparecendo; eles não bloqueiam se o build terminar com sucesso.

Se surgir um erro novo, copie o trecho a partir de `Build error occurred` ou `Type error` e continue a partir dele.

## Importante

- Não rode a migration 010 antes de o build passar.
- Não faça `git add .`.
- Não ative RLS manualmente.
