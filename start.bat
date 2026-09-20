@echo off
title ECDAT — Enterprise Cryptographic Discovery & Analysis Tool
cls
echo ====================================================================
echo  ECDAT — Enterprise Cryptographic Discovery & Analysis Tool
echo  SIH26164 | Local-First | Privacy-First | NIST-Referenced
echo ====================================================================
echo.

if not exist backend\node_modules (
    echo [SETUP] Installing backend Node.js dependencies...
    cd backend && call npm install && cd ..
)

if not exist frontend\node_modules (
    echo [SETUP] Installing frontend Node.js dependencies...
    cd frontend && call npm install && cd ..
)

echo [1/2] Starting ECDAT Local Backend API (Port 5000)...
start /b cmd /c "cd backend && npm start"

echo [2/2] Starting ECDAT Frontend Web Application (Port 5173)...
start /b cmd /c "cd frontend && npm run dev"

echo.
echo ====================================================================
echo  ECDAT Local Application Launching!
echo  Open Browser: http://localhost:5173
echo  Default Analyst Credentials: analyst / password123
echo ====================================================================
echo Press Ctrl+C in this terminal to terminate servers.
pause
