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
taskkill /f /im wscript.exe >nul 2>&1
taskkill /f /im cscript.exe >nul 2>&1

:: Arka planda calisan eski cmd dongulerini kapat
powershell -NoProfile -Command "$myPid = $PID; $parentPid = (Get-CimInstance Win32_Process -Filter \"ProcessId=$myPid\").ParentProcessId; Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -ne $parentPid -and ($_.CommandLine -like '*Bekci_ArkaPlan*' -or $_.CommandLine -like '*--background-loop*' -or $_.CommandLine -like '*Baslat.bat*') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" >nul 2>&1

for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001 ^| findstr LISTENING') do (
    if not "%%a"=="0" (
        echo [BILGI] Port 3001'i kullanan islem kapatiliyor - PID: %%a
        taskkill /f /t /pid %%a >nul 2>&1
    )
)

ping 127.0.0.1 -n 3 >nul

echo.
echo [BASARILI] Port 3001 Saha Takip arka plan servisi ve tum terminal donguleri tamamen durduruldu.
echo Bu pencere 3 saniye icinde kapanacaktir...
ping 127.0.0.1 -n 4 >nul
exit /b 0
