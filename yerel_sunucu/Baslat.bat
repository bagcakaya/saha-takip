@echo off
chcp 65001 >nul
cd /d "%~dp0"

:: Eski --background-loop cagrisi gelirse aninda cik (Terminal acilip kapanmasini engeller)
if "%~1"=="--background-loop" exit /b 0

title Saha Takip - Yerel Sunucu ve Web Paneli (Arka Plan Baslatici)

:: 1. Yonetici (Administrator) yetkisi kontrolu
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [BILGI] Port 3001 servisini yonetmek icin Yonetici yetkisi aliniyor...
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b 0
)

echo ==========================================================
echo   SAHA TAKIP SISTEMI - GIZLI ARKA PLAN SERVIS BASLATICI
echo ==========================================================
echo.

:: 2. Eski acilip kapanan terminal dongulerini ve Port 3001 islemini tamamen temizle
echo [1/3] Eski arka plan donguleri ve Port 3001 temizleniyor...
echo 1 > ".servis_durduruldu"
schtasks /End /TN "SahaTakip_YerelSunucu_3001" >nul 2>&1
taskkill /f /im wscript.exe >nul 2>&1
taskkill /f /im cscript.exe >nul 2>&1

:: Eski Bekci_ArkaPlan veya --background-loop cmd pencerelerini kapat
powershell -NoProfile -Command "$myPid = $PID; $parentPid = (Get-CimInstance Win32_Process -Filter \"ProcessId=$myPid\").ParentProcessId; Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -ne $parentPid -and ($_.CommandLine -like '*Bekci_ArkaPlan*' -or $_.CommandLine -like '*--background-loop*') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" >nul 2>&1

for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001 ^| findstr LISTENING') do (
    if not "%%a"=="0" (
        echo       Port 3001'i tutan eski islem kapatiliyor - PID: %%a
        taskkill /f /t /pid %%a >nul 2>&1
    )
)
ping 127.0.0.1 -n 2 >nul

:: 3. Arka_Planda_Baslat.vbs dosyasinin guncel oldugundan emin ol
(
echo Set WshShell = CreateObject^("WScript.Shell"^)
echo Set fso = CreateObject^("Scripting.FileSystemObject"^)
echo scriptDir = fso.GetParentFolderName^(WScript.ScriptFullName^)
echo WshShell.CurrentDirectory = scriptDir
echo nodeExe = "node.exe"
echo If fso.FileExists^("C:\Program Files\nodejs\node.exe"^) Then nodeExe = "C:\Program Files\nodejs\node.exe"
echo WshShell.Run """" ^& nodeExe ^& """ """ ^& scriptDir ^& "\server.js""", 0, False
) > "%~dp0Arka_Planda_Baslat.vbs"

:: 4. Guvenlik Duvari ve Acilis Gorevini Tanimla (wscript ile sifir pencere)
echo [2/3] Windows Arka Plan ve Port 3001 izni ayarlaniyor...
netsh advfirewall firewall delete rule name="Saha Takip API Port 3001" >nul 2>&1
netsh advfirewall firewall add rule name="Saha Takip API Port 3001" dir=in action=allow protocol=TCP localport=3001 >nul 2>&1
schtasks /Create /TN "SahaTakip_YerelSunucu_3001" /TR "wscript.exe //B //NoLogo \"%~dp0Arka_Planda_Baslat.vbs\"" /SC ONSTART /RU SYSTEM /RL HIGHEST /F >nul 2>&1

:: 5. dogrudan wscript ile (Terminal / CMD kullanmadan) node.exe'yi gizli baslat
echo [3/3] Saha Takip Yerel Sunucu tamamen gizli modda (Terminal olmadan) baslatiliyor...
wscript.exe //B //NoLogo "%~dp0Arka_Planda_Baslat.vbs"

ping 127.0.0.1 -n 4 >nul

echo.
powershell -NoProfile -Command "try { $r = Invoke-RestMethod -Uri 'http://127.0.0.1:3001/api/web-status' -TimeoutSec 5; Write-Host '==========================================================' -ForegroundColor Green; Write-Host '  [BASARILI] SERVIS ARKA PLANDA SESSIZCE CALISIYOR!' -ForegroundColor Green; Write-Host ('  - Durum: ' + $r.status + ' | Port: 3001 | Hicbir Terminal acilmaz') -ForegroundColor Green; Write-Host '  - Kapatmak isterseniz Durdur.bat calistirabilirsiniz.' -ForegroundColor Green; Write-Host '==========================================================' -ForegroundColor Green } catch { Write-Host '  [BILGI] Servis arka planda baslatildi.' -ForegroundColor Yellow }"

echo.
echo Bu pencere 4 saniye icinde kendiliginden kapanacaktir...
ping 127.0.0.1 -n 5 >nul
exit /b 0
