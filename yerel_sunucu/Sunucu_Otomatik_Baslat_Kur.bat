@echo off
chcp 65001 >nul
title Saha Takip - Windows Server 7/24 Otomatik Baslatma Kurulumu
cd /d "%~dp0"

:: Yonetici yetkisi kontrolu (Yoksa otomatik UAC izni ister)
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [BILGI] Yonetici yetkisi isteniyor...
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

echo =================================================================
echo   SAHA TAKIP YEREL SUNUCU - 7/24 OTOMATIK BASLATMA KURULUMU
echo =================================================================
echo.

set "SCRIPT_PATH=%~dp0Bekci_ArkaPlan.bat"
set "TASK_NAME=SahaTakip_YerelSunucu_3001"

if not exist "%SCRIPT_PATH%" (
    echo [HATA] Bekci_ArkaPlan.bat bulunamadi: %SCRIPT_PATH%
    pause
    exit /b 1
)

:: 1. Windows Guvenlik Duvarinda TCP 3001 Portunu Ac
echo [1/3] Windows Guvenlik Duvari Port 3001 izni tanimlaniyor...
netsh advfirewall firewall delete rule name="Saha Takip API Port 3001" >nul 2>&1
netsh advfirewall firewall add rule name="Saha Takip API Port 3001" dir=in action=allow protocol=TCP localport=3001 >nul
echo       OK - TCP Port 3001 gelen baglantilara acildi.
echo.

:: 2. Windows Gorev Zamanlayiciya (SYSTEM olarak, Oturum Acmadan Acilista Calisacak Sekilde) Kaydet
echo [2/3] Windows Server acilisinda otomatik baslatma gorevi kaydediliyor...
schtasks /Create /TN "%TASK_NAME%" /TR "\"%SCRIPT_PATH%\"" /SC ONSTART /RU SYSTEM /RL HIGHEST /F >nul
if %errorlevel% neq 0 (
    echo [HATA] Gorev Zamanlayici kaydi olusturulamadi!
    pause
    exit /b 1
)
echo       OK - "%TASK_NAME%" gorevi kaydedildi (Sunucu yeniden baslasa bile oturum acmadan calisir).
echo.

:: 3. Servisi Hemen Simdi Baslat ve Test Et
echo [3/3] Saha Takip Yerel Sunucu hemen baslatiliyor...
if exist ".servis_durduruldu" del /f /q ".servis_durduruldu" >nul 2>&1
schtasks /Run /TN "%TASK_NAME%" >nul
ping 127.0.0.1 -n 5 >nul

echo.
echo [TEST] http://127.0.0.1:3001/api/health kontrol ediliyor...
powershell -NoProfile -Command "try { $r = Invoke-RestMethod -Uri 'http://127.0.0.1:3001/api/health' -TimeoutSec 6; Write-Host ('      BASARILI! Durum: ' + $r.status + ' | Veritabani: ' + $r.database) -ForegroundColor Green } catch { Write-Host ('      UYARI: Henuz yanit alinamadi (' + $_.Exception.Message + '). sunucu_calisma.log dosyasini kontrol edin.') -ForegroundColor Yellow }"

echo.
echo =================================================================
echo   KURULUM TAMAMLANDI!
echo   - Sunucu her yeniden basladiginda Port 3001 otomatik acilacak.
echo   - Olasi bir hatada servis 5 sn icinde kendini kurtaracak.
echo   - Kapali kalinan suredeki Supabase verileri otomatik esitlenecek.
echo =================================================================
echo.
pause
