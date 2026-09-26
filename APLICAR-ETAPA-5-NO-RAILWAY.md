# Aplicar Etapa 5 no Railway

1. Extraia o ZIP na raiz do projeto e substitua os arquivos.
2. Não execute migration.
3. Não execute npm install adicional.
4. Confira `git status`.
5. Adicione somente os arquivos listados abaixo.
6. Faça commit e push para `main`; o Railway fará o deploy automático.

## Git

```powershell
git add app/page.tsx
git add app/cardapio/page.tsx
git add app/pedir/page.tsx
git add -- ":(literal)app/loja/[slug]/page.tsx"
git add -- ":(literal)app/loja/[slug]/cardapio/page.tsx"
git add -- ":(literal)app/loja/[slug]/pedir/page.tsx"
git add -- ":(literal)app/pedido/[reference]/page.tsx"
git add -- ":(literal)app/loja/[slug]/pedido/[reference]/page.tsx"
git add components/admin/links-panel.tsx
git add components/admin/settings-panel.tsx
git add components/store/store-landing-page.tsx
git add components/store/storefront.tsx
git add lib/organization-db.ts
git add lib/public-host.ts
git add lib/types.ts
git add docs/etapas/ETAPA-5-PRESENCA-DIGITAL.md

git status
git diff --cached --stat
git commit -m "Etapa 5 - landing page e presenca digital das empresas"
git push origin main
```

## Testar no Railway

- `/loja/SEU-SLUG`
- `/loja/SEU-SLUG/cardapio`
- `/loja/SEU-SLUG/pedir`
- Configurações da loja > Página de apresentação da empresa
- Links e QR Codes
