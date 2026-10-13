@echo off
chcp 65001 >nul
title İş Takip Sistemi - Logları Güncelle
echo ====================================================================
echo      İŞ TAKİP SİSTEMİ - BULUT HATA VE SİSTEM LOGLARINI ÇEKME
echo ====================================================================
echo.
cd /d "%~dp0"
node scripts\sync_system_logs.js
echo.
echo ====================================================================
echo Log dosyası: "%~dp0Logs\is_takip_hatalari.log"
echo.
pause
