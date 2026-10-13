@echo off
echo ========================================================
echo MeetSpace - Share with Friend Online
echo ========================================================
echo.
if not exist "%~dp0.client-port" (
  echo MeetSpace is not running, or its client port is not ready.
  echo Start MeetSpace first with start-all.bat, then run this file again.
  echo.
  pause
  exit /b 1
)
set /p CLIENT_PORT=<"%~dp0.client-port"
curl.exe --fail --silent --max-time 2 --output NUL "http://localhost:%CLIENT_PORT%/" >nul 2>&1
if errorlevel 1 (
  echo MeetSpace is not responding on its recorded client port %CLIENT_PORT%.
  echo Start it with start-all.bat and try again.
  echo.
  pause
  exit /b 1
)
echo Creating an HTTPS link to MeetSpace on port %CLIENT_PORT%...
echo When the link appears, open it on this PC, create the meeting there,
echo then copy and send the meeting link to your friend.
echo Keep this window open while your friend is using the meeting.
echo.
call npx.cmd --yes localtunnel --port %CLIENT_PORT%
pause
