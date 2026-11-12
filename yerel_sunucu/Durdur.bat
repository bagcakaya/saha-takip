@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Saha Takip - Arka Plan Servisini Durdur

:: Yonetici (Administrator) yetkisi kontrolu
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [BILGI] Arka plan servisini durdurmak icin Yonetici yetkisi aliniyor...
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b 0
)

echo ==========================================================
echo   SAHA TAKIP YEREL SUNUCU ARKA PLAN SERVISI DURDURULUYOR
echo ==========================================================
echo.

echo 1 > ".servis_durduruldu"
schtasks /End /TN "SahaTakip_YerelSunucu_3001" >nul 2>&1

:: Arka planda calisan Bekci_ArkaPlan veya --background-loop sureclerini kapat
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*Bekci_ArkaPlan*' -or $_.CommandLine -like '*--background-loop*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" >nul 2>&1

for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001 ^| findstr LISTENING') do (
    if not "%%a"=="0" (
        echo [BILGI] Port 3001'i kullanan islem kapatiliyor - PID: %%a
        taskkill /f /t /pid %%a >nul 2>&1
        powershell -NoProfile -Command "Stop-Process -Id %%a -Force -ErrorAction SilentlyContinue" >nul 2>&1
    )
)

ping 127.0.0.1 -n 3 >nul
if exist ".servis_durduruldu" del /f /q ".servis_durduruldu" >nul 2>&1

echo.
echo [BASARILI] Port 3001 Saha Takip arka plan servisi tamamen durduruldu.
echo Diger projeler etkilenmedi.
echo Bu pencere 3 saniye icinde kapanacaktir...
ping 127.0.0.1 -n 4 >nul
exit /b 0
