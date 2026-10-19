# PowerShell: run this file from the unzipped project root.
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root
if (-not (Get-Command py -ErrorAction SilentlyContinue) -and -not (Get-Command python -ErrorAction SilentlyContinue)) {
  throw 'Python 3.10+ installation is required. Install Python first.'
}
# Prefer setup-python's pinned executable (GitHub runner) over py launcher's system default.
$Python = if (Get-Command python -ErrorAction SilentlyContinue) { 'python' } else { 'py' }
& $Python -c "import sys; assert (3,10) <= sys.version_info[:2] < (3,14), 'Python 3.10-3.13 required'"
if ($LASTEXITCODE -ne 0) { throw 'Unsupported Python version' }
& $Python -m venv .venv
if ($LASTEXITCODE -ne 0) { throw 'Failed to create Python virtual environment' }
& (Join-Path $Root '.venv\Scripts\python.exe') -m pip install --upgrade pip
if ($LASTEXITCODE -ne 0) { throw 'pip upgrade failed' }
& (Join-Path $Root '.venv\Scripts\python.exe') -m pip install -r (Join-Path $Root 'backend\requirements.txt')
if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed' }
Write-Host 'Installing 48,037-word free dictionary (one-time, 7MB download)...'
& (Join-Path $Root '.venv\Scripts\python.exe') (Join-Path $Root 'tools\prepare_dictionary.py')
if ($LASTEXITCODE -ne 0) { throw 'Dictionary installation failed. Network may be unavailable.' }
Write-Host 'Installation complete. Run start-server.bat, then load the extension folder in Chrome.' -ForegroundColor Green
