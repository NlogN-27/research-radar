@echo off
setlocal
cd /d "%~dp0"

rem If Research Radar is already running, just open it.
powershell -NoProfile -Command "try { $null = Invoke-WebRequest -UseBasicParsing 'http://localhost:5173' -TimeoutSec 2; exit 0 } catch { exit 1 }"
if not errorlevel 1 (
  start "" "http://localhost:5173"
  exit /b 0
)

rem Prefer an ordinary Node.js installation, with the Codex runtime as a fallback.
set "CODEX_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin"
set "CODEX_PNPM=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback"
if exist "%CODEX_NODE%\node.exe" set "PATH=%CODEX_NODE%;%PATH%"
if exist "%CODEX_PNPM%\pnpm.cmd" set "PATH=%CODEX_PNPM%;%PATH%"

where node >nul 2>&1
if errorlevel 1 goto missing_runtime
where pnpm >nul 2>&1
if errorlevel 1 goto missing_runtime

if not exist "node_modules\" (
  echo Installing Research Radar dependencies for the first run...
  call pnpm install
  if errorlevel 1 goto failed
)

echo Starting Research Radar at http://localhost:5173
echo Keep this window open. Press Ctrl+C to stop the app.
start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 4; Start-Process 'http://localhost:5173'"
call pnpm dev
exit /b %errorlevel%

:missing_runtime
echo.
echo Node.js 22.13+ and pnpm are required.
echo Install Node.js, then run: corepack enable
pause
exit /b 1

:failed
echo.
echo Research Radar could not be started. Review the error above.
pause
exit /b 1
