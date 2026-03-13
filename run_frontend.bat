@echo off
title ZenoHosp HMS — Frontend

echo.
echo  
echo   ZenoHosp HMS Frontend           
echo   React + TypeScript + Vite   
echo  
echo.

cd /d "%~dp0HMS-frontend"

echo  Starting frontend on http://localhost:5173
echo  Backend proxy  → http://localhost:8080
echo  Press Ctrl+C to stop.
echo.

call npm run dev

pause
