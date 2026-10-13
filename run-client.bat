@echo off
title MeetSpace Frontend Client
echo ========================================================
echo Starting MeetSpace Frontend Client on http://localhost:5173
echo ========================================================
cd /d "%~dp0client"
call npm.cmd run dev
pause
