@echo off
title OpenRadar Installer

echo.
echo ==============================
echo        OpenRadar Installer
echo ==============================
echo.

cd /d "%~dp0"

echo [1/4] Installing frontend dependencies...
cd frontend
call npm install
if errorlevel 1 (
    echo.
    echo ERROR: Frontend npm install failed.
    pause
    exit /b 1
)

cd ..

echo.
echo [2/4] Creating Python virtual environment...
cd backend

if not exist ".venv" (
    python -m venv .venv
)

call .venv\Scripts\activate.bat

echo.
echo [3/4] Installing backend dependencies...

if exist requirements.txt (
    python -m pip install -r requirements.txt
) else (
    echo WARNING: backend\requirements.txt not found.
)

cd ..

echo.
echo [4/4] Installing JetPhotos dependencies...
cd jetphotos

if exist package.json (
    call npm install
) else (
    echo WARNING: jetphotos\package.json not found.
)

cd ..

echo.
echo ==============================
echo       Installation complete!
echo ==============================
echo.
echo You can now run start.bat
echo.

pause