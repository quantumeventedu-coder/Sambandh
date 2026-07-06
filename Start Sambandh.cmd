@echo off
title Sambandh
cd /d "%~dp0"
echo.
echo   Sambandh - connections, made meaningful
echo   Starting... your browser will open automatically.
echo   Keep this window open while using the app. Close it (or press Ctrl+C) to stop.
echo.
call npm run dev
pause
