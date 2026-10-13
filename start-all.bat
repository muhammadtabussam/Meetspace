@echo off
setlocal EnableDelayedExpansion
title MeetSpace Launcher
echo ========================================================
echo          Starting MeetSpace Video Application
echo ========================================================
echo.

echo [1/3] Starting Backend Signaling Server on http://localhost:3001...
if exist "%~dp0.server-port" del /q "%~dp0.server-port"
start "MeetSpace Server (Port 3001)" cmd /k "cd /d ""%~dp0server"" && node server.js"

echo Waiting for the backend to start...
set "SERVER_READY="
for /l %%i in (1,1,20) do (
  if exist "%~dp0.server-port" (
    for /f "usebackq delims=" %%p in ("%~dp0.server-port") do set "SERVER_PORT=%%p"
    curl.exe --fail --silent --max-time 1 --output NUL "http://localhost:!SERVER_PORT!/health" >nul 2>&1
    if not errorlevel 1 (
      set "SERVER_READY=1"
      goto :server_ready
    )
  )
  ping.exe -n 2 -w 1000 127.0.0.1 >nul
)
:server_ready
if not defined SERVER_READY (
  echo MeetSpace backend did not become available. Check the Server window for errors.
  pause
  exit /b 1
)

echo [2/3] Starting Frontend Client...
if exist "%~dp0.client-port" del /q "%~dp0.client-port"
start "MeetSpace Client (Port 5173)" cmd /k "cd /d ""%~dp0client"" && npm.cmd run dev"

echo [3/3] Opening MeetSpace in your browser...
set "CLIENT_PORT=5173"
set "CLIENT_READY="
for /l %%i in (1,1,10) do (
  if exist "%~dp0.client-port" (
    for /f "usebackq delims=" %%p in ("%~dp0.client-port") do set "CLIENT_PORT=%%p"
  )
  curl.exe --fail --silent --max-time 1 --output NUL "http://localhost:!CLIENT_PORT!/" >nul 2>&1
  if not errorlevel 1 (
    set "CLIENT_READY=1"
    goto :client_ready
  )
  ping.exe -n 2 -w 1000 127.0.0.1 >nul
)
:client_ready
if not defined CLIENT_READY (
  echo MeetSpace did not become available. Check the Client window for errors.
  pause
  exit /b 1
)
start "" "http://localhost:!CLIENT_PORT!/"

echo.
echo ========================================================
echo MeetSpace is now running!
echo Open on this PC: http://localhost:!CLIENT_PORT!/
echo Keep both terminal windows open while using the app.
echo ========================================================
echo.
