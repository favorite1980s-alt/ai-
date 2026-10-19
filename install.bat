@echo off
cd /d "%~dp0"
echo ===========================================
echo  Movie English Study - Windows Installer
echo ===========================================
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-windows.ps1"
if errorlevel 1 (
  echo.
  echo Installation failed. Please copy the error message for troubleshooting.
  pause
  exit /b 1
)
echo.
echo Installation done. Next double-click start-server.bat.
pause
