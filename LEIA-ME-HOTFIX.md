# Hotfix — Etapa 12 / ícone Instagram

Corrige o erro de build em `components/admin/marketing-publications-panel.tsx` causado pelo import de `Instagram` em uma versão do `lucide-react` que não disponibiliza esse export.

## Aplicar

Na raiz do projeto:

```powershell
node APLICAR-HOTFIX-ETAPA-12-ICONE-INSTAGRAM.js
npm run build
```

Depois, se passar:

```powershell
git add .
git commit -m "Hotfix Etapa 12 - icone Instagram"
git push origin main
```
