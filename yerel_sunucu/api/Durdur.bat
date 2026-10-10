@echo off
chcp 65001 >nul
title Saha Takip - Servisi Durdur
echo Saha Takip Yerel API servisi durduruluyor...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001 ^| findstr LISTENING') do (
    taskkill /f /pid %%a >nul 2>&1
)
taskkill /f /im node.exe >nul 2>&1
echo Servis başarıyla durduruldu.
timeout /t 2 >nul
