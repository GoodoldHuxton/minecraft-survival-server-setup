@echo off
rem ============================================================
rem  Fulghen Survival - backup
rem  Run from the server folder. Safe while the server is running
rem  when RCON is enabled (see docs/INSTALLATION.md).
rem  Keeps the newest 14 backups in .\backups
rem
rem  Daily automatic backups (Windows Task Scheduler):
rem    schtasks /create /tn "Fulghen Backup" /sc daily /st 05:00 ^
rem      /tr "cmd /c cd /d C:\path\to\server && backup.bat"
rem ============================================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0backup.ps1" -ServerDir "%cd%" -Keep 14
if errorlevel 1 (
    echo Backup FAILED.
    exit /b 1
)
