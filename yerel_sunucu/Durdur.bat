@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Saha Takip - Servisi Durdur

echo Saha Takip Yerel servisi durduruluyor...
echo 1 > ".servis_durduruldu"
schtasks /End /TN "SahaTakip_YerelSunucu_3001" >nul 2>&1

for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001 ^| findstr LISTENING') do (
    echo Port 3001'i kullanan islem kapatiliyor - PID: %%a
    taskkill /f /pid %%a >nul 2>&1
)

echo Port 3001 Saha Takip servisi basariyla durduruldu. Diger projeler etkilenmedi.
ping 127.0.0.1 -n 3 >nul
if exist ".servis_durduruldu" del /f /q ".servis_durduruldu" >nul 2>&1
