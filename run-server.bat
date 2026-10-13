@echo off
title MeetSpace Backend Server
echo ========================================================
echo Starting MeetSpace Backend Server on http://localhost:3001
echo ========================================================
cd /d "%~dp0server"
node server.js
pause
