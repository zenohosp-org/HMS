@echo off
title ZenoHosp HMS — Backend (Local)

echo.
echo  Starting backend...
echo  Profile: local
echo  Port: 9001
echo.

cd /d "%~dp0HMS-backend"
call run_backend.bat
