@echo off
chcp 65001 >nul
cd /d "%~dp0"

if "%~1"=="--background-loop" goto BACKGROUND_LOOP

title Saha Takip - Yerel Sunucu ve Web Paneli (Arka Plan Baslatici)

:: 1. Yonetici (Administrator) yetkisi kontrolu - Port 3001'i tutan SYSTEM/Admin islemlerini kapatabilmek icin sart
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [BILGI] Port 3001 servisini yonetmek icin Yonetici yetkisi aliniyor...
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b 0
)

echo ==========================================================
echo   SAHA TAKIP SISTEMI - 7/24 ARKA PLAN SERVIS BASLATICI
echo ==========================================================
echo.

:: 2. Eski arka plan dongusunu ve Port 3001 islemini temizle
echo [1/3] Port 3001 ve eski arka plan islemleri kontrol ediliyor...
echo 1 > ".servis_durduruldu"
schtasks /End /TN "SahaTakip_YerelSunucu_3001" >nul 2>&1

:: Eski Bekci_ArkaPlan veya --background-loop cmd sureclerini kapat
powershell -NoProfile -Command "$myPid = $PID; $parentPid = (Get-CimInstance Win32_Process -Filter \"ProcessId=$myPid\").ParentProcessId; Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -ne $parentPid -and ($_.CommandLine -like '*Bekci_ArkaPlan*' -or $_.CommandLine -like '*--background-loop*') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" >nul 2>&1

for /L %%i in (1,1,4) do (
    for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001 ^| findstr LISTENING') do (
        if not "%%a"=="0" (
            echo       Port 3001'i tutan eski islem kapatiliyor - PID: %%a
            taskkill /f /t /pid %%a >nul 2>&1
            powershell -NoProfile -Command "Stop-Process -Id %%a -Force -ErrorAction SilentlyContinue" >nul 2>&1
        )
    )
    ping 127.0.0.1 -n 2 >nul
)

if exist ".servis_durduruldu" del /f /q ".servis_durduruldu" >nul 2>&1

:: 3. Guvenlik Duvari ve Sunucu Acilis Gorevini Tanimla
echo [2/3] Windows Arka Plan Koruma ve Port 3001 izni ayarlaniyor...
netsh advfirewall firewall delete rule name="Saha Takip API Port 3001" >nul 2>&1
netsh advfirewall firewall add rule name="Saha Takip API Port 3001" dir=in action=allow protocol=TCP localport=3001 >nul 2>&1
schtasks /Create /TN "SahaTakip_YerelSunucu_3001" /TR "\"%~f0\" --background-loop" /SC ONSTART /RU SYSTEM /RL HIGHEST /F >nul 2>&1

:: 4. Penceresiz Arka Planda (Hidden) Baslat
echo [3/3] Saha Takip Yerel Sunucu ve 7/24 Vardiya Bekcisi ARKA PLANDA baslatiliyor...
powershell -NoProfile -Command "Start-Process -FilePath 'cmd.exe' -ArgumentList '/c .\Baslat.bat --background-loop' -WorkingDirectory (Get-Location).Path -WindowStyle Hidden"

ping 127.0.0.1 -n 4 >nul

echo.
powershell -NoProfile -Command "try { $r = Invoke-RestMethod -Uri 'http://127.0.0.1:3001/api/web-status' -TimeoutSec 5; Write-Host '==========================================================' -ForegroundColor Green; Write-Host '  [BASARILI] SERVIS ARKA PLANDA AKTIF VE CALISIYOR!' -ForegroundColor Green; Write-Host ('  - Durum: ' + $r.status + ' | Port: 3001 | Web Paneli + 7/24 Vardiya Bekcisi') -ForegroundColor Green; Write-Host '  - Bu siyah pencereyi acik birakmaniza GEREK YOKTUR.' -ForegroundColor Green; Write-Host '  - Servis arka planda gizli olarak 7/24 calismaya devam eder.' -ForegroundColor Green; Write-Host '  - Kapatmak isterseniz Durdur.bat calistirabilirsiniz.' -ForegroundColor Green; Write-Host '==========================================================' -ForegroundColor Green } catch { Write-Host '  [BILGI] Arka plan servisi baslatildi, ilk baglanti hazirlaniyor (sunucu_calisma.log)...' -ForegroundColor Yellow }"

echo.
echo Bu pencere 5 saniye icinde kendiliginden kapanacaktir...
ping 127.0.0.1 -n 6 >nul
exit /b 0

:BACKGROUND_LOOP
if exist ".servis_durduruldu" del /f /q ".servis_durduruldu" >nul 2>&1

set "NODE_EXE=node"
where node >nul 2>&1
if %errorlevel% neq 0 (
    if exist "C:\Program Files\nodejs\node.exe" set "NODE_EXE=C:\Program Files\nodejs\node.exe"
    if exist "C:\Program Files (x86)\nodejs\node.exe" set "NODE_EXE=C:\Program Files (x86)\nodejs\node.exe"
)

:WATCHDOG_RESTART
if exist ".servis_durduruldu" (
    del /f /q ".servis_durduruldu" >nul 2>&1
    exit /b 0
)

echo [%date% %time%] Saha Takip Yerel Sunucu (Port 3001) arka planda baslatiliyor... >> "sunucu_calisma.log"
"%NODE_EXE%" server.js >> "sunucu_calisma.log" 2>&1
set "EXIT_CODE=%errorlevel%"

if exist ".servis_durduruldu" (
    del /f /q ".servis_durduruldu" >nul 2>&1
    echo [%date% %time%] Durdur.bat ile arka plan servisi kapatildi. >> "sunucu_calisma.log"
    exit /b 0
)

echo [%date% %time%] Servis beklenmedik sekilde durdu (Kod: %EXIT_CODE%). 4 sn sonra otomatik yeniden baslatiliyor... >> "sunucu_calisma.log"
ping 127.0.0.1 -n 5 >nul
goto WATCHDOG_RESTART
