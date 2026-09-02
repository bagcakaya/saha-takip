@echo off
chcp 65001 >nul
title GitHub'a Yukle - Saha Takip
cd /d "C:\Users\Mert\Desktop\Görev Tamamlama" 2>nul || cd /d "%USERPROFILE%\Desktop\Görev Tamamlama" 2>nul || cd /d "%~dp0"
echo ====================================================
echo   Saha Takip Projesi GitHub'a Yukleniyor...
echo   Hedef: https://github.com/bagcakaya/saha-takip
echo ====================================================
echo.
git push -u origin main
echo.
if %ERRORLEVEL% EQU 0 (
    echo ====================================================
    echo   TEBRIKLER! Tum kodlar basariyla GitHub'a yuklendi!
    echo   Simdi Vercel.com uzerinden yayinlayabilirsiniz.
    echo ====================================================
) else (
    echo ====================================================
    echo   Yukleme tamamlanamadi. Lutfen ekrandaki talimati
    echo   takip edin.
    echo ====================================================
)
echo.
pause
