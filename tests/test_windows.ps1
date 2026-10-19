# GitHub hosted Windows-latest: actual install script + local FastAPI startup (no real Whisper inference).
$ErrorActionPreference='Stop'
$Root=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $Root
Write-Host '[1/4] Windows Python environment and dependency installation'
& (Join-Path $Root 'install-windows.ps1')
if ($LASTEXITCODE -ne 0) { throw 'Windows installer returned error' }
$python=Join-Path $Root '.venv\Scripts\python.exe'
if (-not (Test-Path $python)) {throw 'Python venv missing'}
Write-Host '[2/4] Windows native imports'
& $python -c "import fastapi, numpy, uvicorn, faster_whisper; print('Windows dependencies import OK')"
if ($LASTEXITCODE -ne 0) {throw 'Windows package imports failed'}
Write-Host '[3/5] faster-whisper PyAV WAV decoder compatibility'
& $python tests/test_audio_decode.py
if ($LASTEXITCODE -ne 0) {throw 'faster-whisper audio decode failed'}
Write-Host '[4/5] Verified dictionary exists on Windows'
& $python tests/test_large_dictionary.py
if ($LASTEXITCODE -ne 0) {throw 'Windows dictionary verification failed'}
Write-Host '[5/5] Real Windows process/local HTTP health'
$stdout=Join-Path $env:RUNNER_TEMP 'mes-server.stdout.txt'
$stderr=Join-Path $env:RUNNER_TEMP 'mes-server.stderr.txt'
$p=Start-Process -FilePath $python -WorkingDirectory $Root -ArgumentList 'backend/server.py' -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr
try {
  $ready=$false
  for($i=0;$i -lt 30;$i++){
    if($p.HasExited){throw "Whisper backend exited early: $($p.ExitCode)"}
    try {
      $h=Invoke-RestMethod -Uri 'http://127.0.0.1:8765/health' -TimeoutSec 2
      if($h.ok -and $h.local){$ready=$true;break}
    }catch{}
    Start-Sleep -Seconds 2
  }
  if(-not $ready){throw 'Local Windows health endpoint failed'}
  Write-Host "PASS Windows server: localhost bound, model=$($h.model)"
} finally {
  Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
  if(Test-Path $stderr){Get-Content $stderr -Tail 15}
}
