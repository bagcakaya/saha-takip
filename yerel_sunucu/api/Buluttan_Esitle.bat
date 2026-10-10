@echo off
chcp 65001 >nul
title Saha Takip - Buluttan Manuel Eşitleme
cd /d "%~dp0"

echo ===================================================
echo   SAHA TAKIP - BULUTTAN YERELE VERI ESITLEME
echo ===================================================
echo.
echo [BILGI] Supabase bulut verileri Yerel SQL Server'a aktariliyor...
echo.

powershell -Command "try { $res = Invoke-RestMethod -Uri 'http://127.0.0.1:3001/api/sync-cloud' -Method Post -TimeoutSec 30; Write-Host '✓ Esitleme Basarili: ' $res.message -ForegroundColor Green } catch { Write-Host 'Hata: Yerel API servisinin (Baslat.bat) acik oldugundan emin olun.' -ForegroundColor Red; Write-Host $_.Exception.Message }"

echo.
echo Islem tamamlandi.
pause
