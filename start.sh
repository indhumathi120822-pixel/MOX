#!/usr/bin/env bash

echo "===================================================================="
echo " ECDAT — Enterprise Cryptographic Discovery & Analysis Tool"
echo " SIH26164 | Local-First | Privacy-First | NIST-Referenced"
echo "===================================================================="
echo ""

if [ ! -d "backend/node_modules" ]; then
    echo "[SETUP] Installing backend dependencies..."
    (cd backend && npm install)
fi

if [ ! -d "frontend/node_modules" ]; then
    echo "[SETUP] Installing frontend dependencies..."
    (cd frontend && npm install)
fi

echo "[1/2] Launching ECDAT Backend API Server (Port 5000)..."
(cd backend && npm start) &

echo "[2/2] Launching ECDAT Frontend Web Application (Port 5173)..."
(cd frontend && npm run dev) &

echo ""
echo "===================================================================="
echo " ECDAT Application Online!"
echo " URL: http://localhost:5173"
echo " Default Analyst: analyst / password123"
echo "===================================================================="

wait
