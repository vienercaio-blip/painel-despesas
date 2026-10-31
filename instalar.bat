@echo off
if not "%~1"=="--dentro" ( cmd /k ""%~f0" --dentro" & exit /b )
chcp 65001 >nul
title Instalar o Painel de Despesas
cd /d "%~dp0backend"

echo ============================================
echo   INSTALAR O PAINEL DE DESPESAS
echo ============================================
echo.

echo [1/4] Procurando o Python...
set "PY="
py -3 --version >nul 2>&1 && set "PY=py -3"
if not defined PY (
  python --version >nul 2>&1 && set "PY=python"
)
if not defined PY (
  echo.
  echo  PYTHON NAO ENCONTRADO.
  echo  Instale pelo site python.org e, na primeira tela da instalacao,
  echo  marque a opcao "Add python.exe to PATH". Depois rode este arquivo de novo.
  echo.
  pause
  exit /b 1
)
%PY% --version
echo.

echo [2/4] Criando o ambiente do projeto (pasta .venv)...
if not exist ".venv\Scripts\python.exe" (
  %PY% -m venv .venv
  if errorlevel 1 ( echo  ERRO ao criar o ambiente. & pause & exit /b 1 )
)
echo  OK
echo.

echo [3/4] Instalando as bibliotecas (pode levar 1 ou 2 minutos)...
".venv\Scripts\python.exe" -m pip install --upgrade pip >nul
".venv\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 ( echo. & echo  ERRO ao instalar as bibliotecas. & pause & exit /b 1 )
echo  OK
echo.

echo [4/4] Criando o seu login no painel
echo  (a senha nao aparece enquanto voce digita, e normal)
echo.
".venv\Scripts\python.exe" -m flask --app app criar-usuario
echo.
echo ============================================
echo  INSTALACAO CONCLUIDA.
echo  Agora de dois cliques em "iniciar.bat".
echo ============================================
pause
