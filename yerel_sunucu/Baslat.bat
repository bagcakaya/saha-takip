@echo off
chcp 65001 >nul
title Saha Takip - Yerel Sunucu ve Web Paneli (7/24 Koruma)
cd /d "%~dp0"

if exist ".servis_durduruldu" del /f /q ".servis_durduruldu" >nul 2>&1

echo ===================================================
echo   SAHA TAKIP SISTEMI - YEREL API VE WEB PANELI
echo ===================================================
echo.

:: Yalnizca Port 3001'i kullanan eski islem varsa temizle (Diger projelere dokunmaz)
echo [BILGI] Port 3001 kontrol ediliyor...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001 ^| findstr LISTENING') do (
    echo [BILGI] Port 3001'i tutan eski Saha Takip islemi kapatiliyor - PID: %%a
    taskkill /f /pid %%a >nul 2>&1
)
ping 127.0.0.1 -n 2 >nul

if not exist ".env" (
    echo [UYARI] .env dosyasi bulunamadi!
)

set "NODE_EXE=node"
where node >nul 2>&1
if %errorlevel% neq 0 (
    if exist "C:\Program Files\nodejs\node.exe" set "NODE_EXE=C:\Program Files\nodejs\node.exe"
)

echo.
echo ===================================================
echo   Servis Baslatiliyor (Port: 3001 - Otomatik Kurtarma Aktif)
echo ===================================================
echo Bu pencereyi ACIK BIRAKINIZ (Simge durumuna kucultebilirsiniz).
echo Tamamen kapatmak icin pencereyi kapatabilir veya Durdur.bat calistirabilirsiniz.
echo.

:RESTART_LOOP
if exist ".servis_durduruldu" (
    del /f /q ".servis_durduruldu" >nul 2>&1
    echo [BILGI] Durdurma komutu algilandi, servis kapatildi.
    exit /b 0
)

"%NODE_EXE%" server.js
set "EXIT_CODE=%errorlevel%"

if exist ".servis_durduruldu" (
    del /f /q ".servis_durduruldu" >nul 2>&1
    echo [BILGI] Durdurma komutu algilandi, servis kapatildi.
    exit /b 0
)

echo.
echo [%date% %time%] [DIKKAT] Servis kapandi (Kod: %EXIT_CODE%). 4 saniye icinde otomatik yeniden baslatiliyor...
ping 127.0.0.1 -n 5 >nul
goto RESTART_LOOP
