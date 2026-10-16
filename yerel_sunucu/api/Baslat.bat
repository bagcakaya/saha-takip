@echo off
chcp 65001 >nul
title Saha Takip - Yerel SQL Server API Servisi
cd /d "%~dp0"

echo ===================================================
echo   SAHA TAKIP SISTEMI - YEREL API SERVISI
echo ===================================================
echo.

:: Port 3001'i mesgul eden eski bir arka plan node islemi varsa temizle
echo [BILGI] Yalnizca Port 3001'i kullanan islem kontrol ediliyor...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001 ^| findstr LISTENING') do (
    echo [BILGI] Port 3001'i tutan Saha Takip islemi kapatiliyor - PID: %%a
    taskkill /f /pid %%a >nul 2>&1
)
ping 127.0.0.1 -n 2 >nul

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

if exist "..\..\web\dist" (
    echo [BILGI] Web Paneli dosyalari kontrol ediliyor ve kopyalaniyor...
    xcopy /e /i /y /q "..\..\web\dist" "dist" >nul 2>&1
)

echo.
echo ===================================================
echo   API ve Web Paneli Baslatiliyor (Port: 3001)...
echo ===================================================
echo Bu pencereyi ACIK BIRAKINIZ.
echo Kapatmak icin pencereyi carpisindan kapatabilir veya Ctrl+C yapabilirsiniz.
echo.
node server.js
if %errorlevel% neq 0 (
    echo.
    echo [DIKKAT] Servis bir hata ile kapandi! - Hata Kodu: %errorlevel%
    echo Eger port cakismasi varsa Durdur.bat calistiriniz.
)
pause
