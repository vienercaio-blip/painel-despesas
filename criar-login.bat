@echo off
chcp 65001 >nul
title Criar login no Painel
cd /d "%~dp0backend"
".venv\Scripts\python.exe" -m flask --app app criar-usuario
pause
