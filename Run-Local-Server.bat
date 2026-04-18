@echo off
cd /d "%~dp0"
echo.
echo  Bible Battle Blitz — local server
echo  Open in your browser: http://localhost:5173
echo  Press Ctrl+C here to stop the server.
echo.
npx --yes serve -l 5173 .
