@echo off
chcp 65001 > nul
title Cari Guncelleme Araci - POLATLAR2025

echo =================================================================
echo        POLATLAR2025 - CARI LISTESI GUNCELLEME ARACI
echo =================================================================
echo.
echo SQL Server'dan (POLATLAR2025) Cari listesi cekiliyor...
echo.

cd /d "C:\Users\Mert\Desktop\Görev Tamamlama"

where python >nul 2>nul
if %errorlevel% equ 0 (
    python "scripts\update_cariler.py"
) else (
    "C:\Users\Mert\AppData\Local\Programs\Python\Python311\python.exe" "scripts\update_cariler.py"
)

if %errorlevel% neq 0 (
    echo.
    echo [HATA] Bir sorun olustu! Lutfen SQL Server servisinin calistigindan emin olun.
) else (
    echo.
    echo [BASARILI] Excel dosyaniz web klasorunde guncellendi:
    echo            C:\Users\Mert\Desktop\Görev Tamamlama\web\Cariler.xlsx
    echo            Uygulamaya yeni Cari isimleri yuklendi.
)

echo.
echo =================================================================
pause
