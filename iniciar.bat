@echo off
chcp 65001 >nul
title Painel de Despesas (servidor)
cd /d "%~dp0backend"
if not exist ".venv\Scripts\python.exe" (
  echo O painel ainda nao foi instalado. Rode primeiro "instalar.bat".
  pause
  exit /b 1
)
echo ============================================
echo   PAINEL DE DESPESAS LIGADO
echo   Endereco: http://127.0.0.1:5000
echo   Para desligar, feche esta janela.
echo ============================================
echo.
start "" /min cmd /c "timeout /t 3 >nul & start http://127.0.0.1:5000"
".venv\Scripts\python.exe" -m flask --app app run --debug
pause
