@echo off
cd /d "%~dp0"
code .
if errorlevel 1 (
  echo Nao foi possivel executar o comando "code".
  echo Abra o VS Code e use Arquivo - Abrir Pasta, escolhendo esta pasta.
  pause
)
