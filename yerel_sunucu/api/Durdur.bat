@echo off
chcp 65001 >nul
title Saha Takip - Servisi Durdur
echo Saha Takip Yerel API servisi durduruluyor...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001 ^| findstr LISTENING') do (
    echo Port 3001'i kullanan islem kapatiliyor - PID: %%a
    taskkill /f /pid %%a >nul 2>&1
)
echo Port 3001 Saha Takip servisi basariyla durduruldu. Diger projeler etkilenmedi.
ping 127.0.0.1 -n 3 >nul
