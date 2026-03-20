@echo off
title ZenoHosp HMS — Backend

echo.
echo  ╔══════════════════════════════════════╗
echo  ║      ZenoHosp HMS Backend            ║
echo  ║      Spring Boot 3.4.3 / Java 21     ║
echo  ╚══════════════════════════════════════╝
echo.

cd /d "%~dp0HMS-backend"

set JAVA_HOME=C:\Java\jdk-21.0.10
set PATH=%JAVA_HOME%\bin;%PATH%

echo  Starting backend on http://localhost:9001
echo  Press Ctrl+C to stop.
echo.

call mvnw.cmd spring-boot:run -Dspring-boot.run.profiles=local

pause
