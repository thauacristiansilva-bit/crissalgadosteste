# Aplicar Etapa 6 no Railway

Extraia o ZIP na raiz do projeto e substitua os arquivos.

Não execute migration, SQL ou npm install.

Adicione somente os arquivos desta etapa:

```powershell
git add components/store/storefront.tsx
git add components/catalog/product-customizer.tsx
git add docs/etapas/ETAPA-6-CARDAPIO-CHECKOUT.md
```

Confira:

```powershell
git status
git diff --cached --stat
```

Commit e push:

```powershell
git commit -m "Etapa 6 - melhora cardapio e checkout"
git push origin main
```

O Railway fará build e deploy automaticamente.
