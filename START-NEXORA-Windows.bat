@echo off
REM NEXORA - double-click to start on Windows. Leave this window open while you use NEXORA.
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Opening nodejs.org - install the LTS version, then run this file again.
  start https://nodejs.org/en/download
  pause
  exit /b 1
)
if not exist node_modules (
  echo First run: installing NEXORA, about a minute...
  call npm install --no-fund --no-audit
)
echo Starting NEXORA at http://localhost:3001 ...
start "" cmd /c "timeout /t 6 >nul & start http://localhost:3001"
call npm run dev
