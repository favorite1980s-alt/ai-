# PowerShell: run this file from the unzipped project root.
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root
if (-not (Get-Command py -ErrorAction SilentlyContinue) -and -not (Get-Command python -ErrorAction SilentlyContinue)) {
  throw 'Python 3.10+ installation is required. Install Python first.'
}
$Python = if (Get-Command py -ErrorAction SilentlyContinue) { 'py' } else { 'python' }
& $Python -m venv .venv
if ($LASTEXITCODE -ne 0) { throw 'Failed to create Python virtual environment' }
& (Join-Path $Root '.venv\Scripts\python.exe') -m pip install --upgrade pip
if ($LASTEXITCODE -ne 0) { throw 'pip upgrade failed' }
& (Join-Path $Root '.venv\Scripts\python.exe') -m pip install -r (Join-Path $Root 'backend\requirements.txt')
if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed' }
Write-Host 'Installation complete. Run start-server.bat, then load the extension folder in Chrome.' -ForegroundColor Green
