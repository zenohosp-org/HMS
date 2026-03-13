@echo off
title ZenoHosp HMS — Frontend

echo.
echo  ╔══════════════════════════════════════╗
echo  ║      ZenoHosp HMS Frontend           ║
echo  ║      React + TypeScript + Vite       ║
echo  ╚══════════════════════════════════════╝
echo.

cd /d "%~dp0"

echo  Starting frontend on http://localhost:5174
echo  Backend proxy  → http://localhost:9001
echo  Press Ctrl+C to stop.
echo.

call npm run dev

pause
