@echo off
cd /d "%~dp0"
title Cris Salgados - Servidor

echo ==========================================
echo       CRIS SALGADOS - SISTEMA
echo ==========================================
echo.

if not exist "package.json" (
  echo ERRO: package.json nao encontrado nesta pasta.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Instalando dependencias pela primeira vez...
  call npm install
  if errorlevel 1 (
    echo.
    echo Falha no npm install. Confira o erro acima.
    pause
    exit /b 1
  )
)

echo.
echo Iniciando servidor...
echo Site:  http://localhost:3000
echo Admin: http://localhost:3000/admin
echo.
call npm run dev
pause
