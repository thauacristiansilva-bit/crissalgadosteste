# HOTFIX ETAPA 12 — TYPECHECK

Este hotfix corrige o erro em que o `npm run build` continua encontrando o import antigo
`Instagram` dentro de:

- `_backups/.../marketing-publications-panel.tsx`
- `ARQUIVOS-GERADOS/components/admin/marketing-publications-panel.tsx`

Essas pastas não fazem parte do código executado e não devem ser verificadas pelo TypeScript.

## Como aplicar

Extraia este ZIP na raiz do Sabor Flow e rode:

```powershell
node APLICAR-HOTFIX-ETAPA-12-TYPECHECK.js
npm run build
```

Se o build passar:

```powershell
git add .
git commit -m "Hotfix Etapa 12 - excluir backups do typecheck"
git push origin main
```

O script cria backup do `tsconfig.json` antes da alteração.
