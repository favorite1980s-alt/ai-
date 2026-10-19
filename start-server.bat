@echo off
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  echo Missing environment. Run install-windows.ps1 first.
  pause
  exit /b 1
)
set MES_MODEL=small
set MES_DEVICE=cpu
set MES_COMPUTE=int8
echo Movie English Study - Local Whisper server
echo Keep this window open while watching a movie.
".venv\Scripts\python.exe" backend\server.py
pause
