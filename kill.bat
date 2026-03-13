@echo off
REM Kill all processes running on common ports used by HMS
REM Port 8080 - Backend (Spring Boot)
REM Port 5173 - Frontend (Vite dev server)
REM Port 3000 - Alternative Node.js port

echo Killing processes on ports 8080, 5173, and 3000...
echo.

REM Kill port 8080 (Backend)
echo Checking port 8080...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8080') do (
    echo Found process %%a on port 8080. Killing it...
    taskkill /PID %%a /F >nul 2>&1
)

REM Kill port 5173 (Vite Frontend)
echo Checking port 5173...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173') do (
    echo Found process %%a on port 5173. Killing it...
    taskkill /PID %%a /F >nul 2>&1
)

REM Kill port 3000 (Alternative Node.js)
echo Checking port 3000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000') do (
    echo Found process %%a on port 3000. Killing it...
    taskkill /PID %%a /F >nul 2>&1
)

echo.
echo All processes terminated successfully!
echo.
pause
