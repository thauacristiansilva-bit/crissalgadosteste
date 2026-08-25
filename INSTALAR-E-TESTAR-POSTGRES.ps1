# SaborFlow - Fase 1 PostgreSQL
# Execute na RAIZ do projeto, depois de copiar os arquivos deste pacote.

Write-Host "1/5 - Encerrando processos Node..." -ForegroundColor Cyan
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

Write-Host "2/5 - Removendo pastas temporarias que nao podem entrar no build..." -ForegroundColor Cyan
git rm -r --ignore-unmatch fix_login_sidebar_footer v16patch admin_brand_update v15patch v16_1patch painel_sem_logos
Remove-Item -Recurse -Force .\fix_login_sidebar_footer -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .\v16patch -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .\admin_brand_update -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .\v15patch -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .\v16_1patch -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .\painel_sem_logos -ErrorAction SilentlyContinue

Write-Host "3/5 - Instalando driver PostgreSQL..." -ForegroundColor Cyan
npm install pg
npm install -D @types/pg

Write-Host "4/5 - Limpando cache Next.js..." -ForegroundColor Cyan
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue

Write-Host "5/5 - Testando build de producao..." -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -eq 0) {
  Write-Host ""
  Write-Host "BUILD OK. Agora faca o commit e push conforme o LEIA-ME." -ForegroundColor Green
} else {
  Write-Host ""
  Write-Host "BUILD FALHOU. Nao faca commit ainda. Copie o primeiro erro TypeScript/Failed to compile." -ForegroundColor Red
  exit $LASTEXITCODE
}
