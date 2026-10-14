@echo off
title Harm [Auto-Restart]
:loop
cls
echo [Harm] Starting bot with automatic file watcher...
node --watch src/index.js
echo.
echo [Harm] Process ended or crashed. Restarting in 3 seconds... (Ctrl+C to abort)
timeout /t 3 >nul
goto loop
