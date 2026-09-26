# Aplicar Etapa 6.1 no Railway

1. Extraia este ZIP na raiz do projeto SaborFlow e confirme a substituição dos arquivos.
2. Não execute migration, SQL ou npm install.
3. Rode `git status`.
4. Adicione somente os arquivos desta etapa com os comandos abaixo.

```powershell
git add lib/types.ts
git add lib/organization-db.ts
git add lib/demo-db.ts
git add lib/organization-onboarding.ts
git add lib/tenant-checkout.ts
git add lib/order-db.ts
git add app/api/client/orders/route.ts
git add app/api/orders/accept-pending/route.ts
git add components/admin/settings-panel.tsx
git add components/admin/orders-panel.tsx
git add components/store/client-account-modal.tsx
git add components/store/storefront.tsx
git add components/store/order-tracker.tsx
git add docs/etapas/ETAPA-6-1-ACEITE-E-ACOMPANHAMENTO.md
```

5. Confira `git status`.
6. Faça o commit e push:

```powershell
git commit -m "Etapa 6.1 - aceite de pedidos e acompanhamento persistente"
git push origin main
```

O Railway fará o build e o deploy automaticamente.
