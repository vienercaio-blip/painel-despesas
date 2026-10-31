@echo off
cd /d "%~dp0backend"
set "LOG=%~dp0diagnostico.txt"
echo === diagnostico %date% %time% === > "%LOG%"
echo --- python --- >> "%LOG%"
".venv\Scripts\python.exe" --version >> "%LOG%" 2>&1
echo --- bibliotecas --- >> "%LOG%"
".venv\Scripts\python.exe" -m pip list >> "%LOG%" 2>&1
echo --- carregar o app --- >> "%LOG%"
".venv\Scripts\python.exe" -c "import sys; sys.path.insert(0,'.'); from app import create_app; a=create_app(); print('APP OK', a.config['BANCO'])" >> "%LOG%" 2>&1
echo --- comando flask --- >> "%LOG%"
".venv\Scripts\flask.exe" --app app --help >> "%LOG%" 2>&1
echo --- fim --- >> "%LOG%"
echo Pronto. Pode fechar esta janela e avisar no chat.
pause
