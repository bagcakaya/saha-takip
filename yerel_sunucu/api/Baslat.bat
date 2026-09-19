@echo off
chcp 65001 >nul
title Saha Takip - Yerel SQL Server API Servisi
cd /d "%~dp0"

echo ===================================================
echo   SAHA TAKİP SİSTEMİ - YEREL API SERVİSİ
echo ===================================================
echo.

if not exist ".env" (
    echo [UYARI] .env dosyasi bulunamadi! .env.example dosyasindan olusturuluyor...
    copy .env.example .env
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
