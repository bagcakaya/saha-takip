@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist ".env" (
    copy .env.example .env >nul
)
if exist "C:\Windows\System32\notepad.exe" (
    start C:\Windows\System32\notepad.exe "%~dp0.env"
) else (
    start write.exe "%~dp0.env"
)
exit
