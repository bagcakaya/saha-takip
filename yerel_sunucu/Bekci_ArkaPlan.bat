@echo off
chcp 65001 >nul
cd /d "%~dp0"

if exist ".servis_durduruldu" del /f /q ".servis_durduruldu" >nul 2>&1

:: Port 3001 uzerinde asili kalmis eski islem varsa temizle
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001 ^| findstr LISTENING') do (
    taskkill /f /pid %%a >nul 2>&1
)
ping 127.0.0.1 -n 2 >nul

set "NODE_EXE=node"
where node >nul 2>&1
if %errorlevel% neq 0 (
    if exist "C:\Program Files\nodejs\node.exe" set "NODE_EXE=C:\Program Files\nodejs\node.exe"
    if exist "C:\Program Files (x86)\nodejs\node.exe" set "NODE_EXE=C:\Program Files (x86)\nodejs\node.exe"
)

:WATCHDOG_LOOP
if exist ".servis_durduruldu" (
    del /f /q ".servis_durduruldu" >nul 2>&1
    exit /b 0
)

echo [%date% %time%] Saha Takip Yerel Sunucu (Port 3001) baslatiliyor... >> "sunucu_calisma.log"
"%NODE_EXE%" server.js >> "sunucu_calisma.log" 2>&1
set "EXIT_CODE=%errorlevel%"

if exist ".servis_durduruldu" (
    del /f /q ".servis_durduruldu" >nul 2>&1
    echo [%date% %time%] Durdur.bat ile servis kapatildi. >> "sunucu_calisma.log"
    exit /b 0
)

echo [%date% %time%] Servis beklenmedik sekilde durdu (Kod: %EXIT_CODE%). 5 sn sonra yeniden baslatiliyor... >> "sunucu_calisma.log"
ping 127.0.0.1 -n 6 >nul
goto WATCHDOG_LOOP
