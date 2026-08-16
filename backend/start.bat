@echo off
title OpenRadar Launcher

echo.
echo ==============================
echo       Starting OpenRadar
echo ==============================
echo.

cd /d "%~dp0"

echo [1/3] Starting OpenRadar Backend...
start "OpenRadar Backend" cmd /k "cd /d "%~dp0" && call .venv\Scripts\activate.bat && uvicorn main:app --reload --port 8000"

timeout /t 2 /nobreak >nul

echo [2/3] Starting OpenRadar Frontend...
start "OpenRadar Frontend" cmd /k "cd /d "%~dp0..\frontend" && npm run dev -- --host 0.0.0.0"

timeout /t 2 /nobreak >nul

echo [3/3] Starting JetPhotos API...
start "JetPhotos API" cmd /k "cd /d "%~dp0..\photos-api" && npm start"

echo.
echo ==============================
echo       OpenRadar Started
echo ==============================
echo.
echo Backend:    http://127.0.0.1:8000
echo Frontend:   http://localhost:5173
echo Photos API: npm start
echo.
pause