@echo off
chcp 65001 >nul
title Saha Takip - Yerel SQL Server API Servisi
cd /d "%~dp0"

echo ===================================================
echo   SAHA TAKIP SISTEMI - YEREL API SERVISI
echo ===================================================
echo.

:: Port 3001'i mesgul eden eski bir arka plan node islemi varsa temizle
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001 ^| findstr LISTENING') do (
    echo [BILGI] Port 3001'deki eski oturum sonlandiriliyor (PID: %%a)...
    taskkill /f /pid %%a >nul 2>&1
)

if not exist ".env" (
    echo [UYARI] .env dosyasi bulunamadi! .env.example dosyasindan olusturuluyor...
    copy .env.example .env >nul
    echo Lutfen .env dosyasindaki SQL Server kullanici adi ve sifrenizi kontrol ediniz.
    echo.
)

if not exist "node_modules" (
    echo [BILGI] Ilk kurulum: Gerekli paketler yukleniyor...
    call npm install
    echo.
)

echo [BILGI] API Servisi baslatiliyor...
echo Kapatmak icin pencereyi kapatabilir veya Ctrl+C yapabilirsiniz.
echo.
node server.js
pause
