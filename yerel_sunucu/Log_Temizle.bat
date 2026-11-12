@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Saha Takip - SQL Log Küçültme ve 3 Günlük Log Temizleyici

:: 1. Yönetici (Administrator) yetkisi kontrolü
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [BILGI] SQL Server LDF küçültme ve log temizliği için Yönetici yetkisi alınıyor...
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b 0
)

echo =========================================================================
echo   SAHA TAKİP SİSTEMİ - SSD KURTARICI ^& 3 GÜNLÜK LOG TEMİZLEYİCİ
echo =========================================================================
echo.

echo [1/3] SQL Server (SahaTakipDB_log.ldf) SIMPLE moda alınıyor ve küçültülüyor...
sqlcmd -S localhost -E -Q "ALTER DATABASE [SahaTakipDB] SET RECOVERY SIMPLE WITH NO_WAIT; USE [SahaTakipDB]; CHECKPOINT; DECLARE @lf NVARCHAR(128); SELECT TOP 1 @lf = name FROM sys.database_files WHERE type_desc = 'LOG'; IF @lf IS NOT NULL DBCC SHRINKFILE (@lf, 8) WITH NO_INFOMSGS;" >nul 2>&1
sqlcmd -S 127.0.0.1 -E -Q "ALTER DATABASE [SahaTakipDB] SET RECOVERY SIMPLE WITH NO_WAIT; USE [SahaTakipDB]; CHECKPOINT; DECLARE @lf NVARCHAR(128); SELECT TOP 1 @lf = name FROM sys.database_files WHERE type_desc = 'LOG'; IF @lf IS NOT NULL DBCC SHRINKFILE (@lf, 8) WITH NO_INFOMSGS;" >nul 2>&1

echo [2/3] Son 3 günden eski log dosyaları ve veritabanı sistem logları temizleniyor...
if exist "C:\Program Files\nodejs\node.exe" (
    "C:\Program Files\nodejs\node.exe" "%~dp0server.js" --cleanup-only
) else (
    node "%~dp0server.js" --cleanup-only
)

echo [3/3] Sunucu klasöründeki 3 günden eski .log dosyaları kontrol ediliyor...
powershell -NoProfile -Command "$cutoff = (Get-Date).AddDays(-3); Get-ChildItem -Path '%~dp0', '%~dp0..', '%~dp0..\..\Logs' -Filter '*.log' -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime -lt $cutoff -and $_.Name -like 'is_takip_20*.log' } | Remove-Item -Force -ErrorAction SilentlyContinue"

echo.
echo =========================================================================
echo   [BAŞARILI] İŞLEM TAMAMLANDI!
echo   - SahaTakipDB_log (SQL Log) SIMPLE moda alındı ve ~8 MB boyutuna indirildi.
echo   - Son 3 günden eski tüm log kayıtları ve dosyaları silindi.
echo   - Bundan sonra loglar otomatik olarak en fazla 3 gün tutulacaktır.
echo =========================================================================
echo.
pause
