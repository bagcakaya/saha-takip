@echo off
chcp 65001 >nul
title Saha Takip - Yerel Sunucu ve Web Paneli
cd /d "%~dp0"

echo ===================================================
echo   SAHA TAKIP SISTEMI - YEREL API VE WEB PANELI
echo ===================================================
echo.

:: Yalnizca Port 3001'i kullanan eski islem varsa temizle (Diger projelere dokunmaz)
echo [BILGI] Port 3001 kontrol ediliyor...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001 ^| findstr LISTENING') do (
    echo [BILGI] Port 3001'i tutan Saha Takip islemi kapatiliyor - PID: %%a
    taskkill /f /pid %%a >nul 2>&1
)
ping 127.0.0.1 -n 2 >nul

if not exist ".env" (
    echo [UYARI] .env bulunamadi!
)

echo.
echo ===================================================
echo   Servis Baslatiliyor (Port: 3001)...
echo ===================================================
echo Bu pencereyi ACIK BIRAKINIZ (Simge durumuna kucultebilirsiniz).
echo Kapatmak icin carpisindan kapatabilir veya Durdur.bat calistirabilirsiniz.
echo.
node server.js
if %errorlevel% neq 0 (
    echo.
    echo [DIKKAT] Servis bir hata ile kapandi! - Hata Kodu: %errorlevel%
    echo Eger port cakismasi varsa Durdur.bat calistiriniz.
)
pause
