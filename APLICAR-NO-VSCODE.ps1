$ErrorActionPreference = "Stop"
if (-not (Test-Path "package.json")) { throw "Abra no VS Code a pasta original do projeto (a que contem package.json)." }
$files = @(
  "app/api/categories/route.ts",
  "app/api/products/route.ts",
  "components/admin/admin-dashboard.tsx",
  "components/admin/categories-panel.tsx",
  "components/admin/product-composition-editor.tsx",
  "components/admin/products-panel.tsx",
  "components/catalog/product-customizer.tsx",
  "components/store/storefront.tsx",
  "lib/ai/store-setup.ts",
  "lib/catalog-db.ts",
  "lib/category-hierarchy.ts",
  "lib/food-composition-db.ts",
  "lib/product-composition.ts"
)
git add -- $files
if ($LASTEXITCODE -ne 0) { throw "Falha ao adicionar os arquivos." }
git commit -m "Adiciona subcategorias e precos por sabor"
if ($LASTEXITCODE -ne 0) { throw "Falha no commit; confira se os arquivos foram extraidos na pasta certa." }
git push origin main
if ($LASTEXITCODE -ne 0) { throw "Falha no push; confira a conexao e o acesso ao GitHub." }
Write-Host "Enviado. Aguarde o deploy automatico do Railway."
