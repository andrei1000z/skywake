@echo off
rem Double-click to run Skywake locally: starts the API Worker (port 8787) and the web app (port 5173),
rem then opens the browser. Close the two windows to stop.
cd /d "%~dp0"
if not exist node_modules call pnpm install
start "Skywake API (8787)" cmd /k "cd /d apps\worker && npx wrangler dev --port 8787"
start "Skywake web (5173)" cmd /k "cd /d apps\web && npx vite --port 5173 --strictPort"
timeout /t 6 /nobreak >nul
start "" "http://localhost:5173/#map=7/44.4/26.1"
