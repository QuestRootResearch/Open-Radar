@echo off
title OpenRadar Installer
cd /d "%~dp0"

echo.
echo ==============================
echo        OpenRadar Installer
echo ==============================
echo.

echo [1/4] Installing frontend dependencies...
cd frontend
call npm install
if errorlevel 1 (
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

python -m pip install --upgrade pip

python -m pip install fastapi "uvicorn[standard]" httpx

if exist requirements.txt (
    python -m pip install -r requirements.txt
) else (
    echo No requirements.txt found - installed required packages directly.
)

cd ..

echo.
echo [4/4] Installing JetPhotos API dependencies...

if exist "photos-api\package.json" (
    cd photos-api
    call npm install
    cd ..
) else (
    echo WARNING: photos-api\package.json not found.
)

echo.
echo ==============================
echo     Installation complete!
echo ==============================
echo.
echo You can now run start.bat
echo.

pause
