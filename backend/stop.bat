@echo off
title OpenRadar Stopper

echo.
echo ==============================
echo       Stopping OpenRadar
echo ==============================
echo.

echo Stopping Backend...
taskkill /FI "WINDOWTITLE eq OpenRadar Backend*" /T /F >nul 2>&1

echo Stopping Frontend...
taskkill /FI "WINDOWTITLE eq OpenRadar Frontend*" /T /F >nul 2>&1

echo Stopping JetPhotos API...
taskkill /FI "WINDOWTITLE eq JetPhotos API*" /T /F >nul 2>&1

echo.
echo ==============================
echo       OpenRadar Stopped
echo ==============================
echo.

timeout /t 2 /nobreak >nul