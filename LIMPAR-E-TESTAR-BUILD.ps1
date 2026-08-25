# Execute na raiz do projeto com o servidor parado.
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

# Remove do Git e do disco as pastas de patch que estavam entrando no TypeScript do build.
git rm -r --ignore-unmatch fix_login_sidebar_footer v16patch admin_brand_update v15patch v16_1patch painel_sem_logos
Remove-Item -Recurse -Force .\fix_login_sidebar_footer -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .\v16patch -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .\admin_brand_update -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .\v15patch -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .\v16_1patch -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .\painel_sem_logos -ErrorAction SilentlyContinue

# Limpa o cache e testa o build de produção.
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run build
