# Start the local API and Vite development server. Run from any directory.
$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$backendDir = Join-Path $repoRoot 'backend'
$frontendDir = Join-Path $repoRoot 'frontend'
$pythonExe = Join-Path $backendDir '.venv\Scripts\python.exe'

if (-not (Test-Path $pythonExe)) {
    Write-Host 'Creating backend virtual environment...'
    Push-Location $backendDir
    try {
        python -m venv .venv
        if ($LASTEXITCODE -ne 0) { throw 'Python virtual environment creation failed.' }
        & $pythonExe -m pip install -r requirements.txt
        if ($LASTEXITCODE -ne 0) { throw 'Backend dependency installation failed.' }
    } finally {
        Pop-Location
    }
}

if (-not (Test-Path (Join-Path $frontendDir 'node_modules'))) {
    Write-Host 'Installing frontend dependencies...'
    Push-Location $frontendDir
    try {
        npm.cmd install
        if ($LASTEXITCODE -ne 0) { throw 'Frontend dependency installation failed.' }
    } finally {
        Pop-Location
    }
}

if (-not $env:DATABASE_URL) {
    $env:DATABASE_URL = 'sqlite:///./dev.db'
}
Write-Host "Using DATABASE_URL=$env:DATABASE_URL"

$backendJob = Start-Job -Name SentinelBackend -ScriptBlock {
    param($backendDir, $pythonExe, $databaseUrl)
    Set-Location $backendDir
    $env:DATABASE_URL = $databaseUrl
    & $pythonExe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
} -ArgumentList $backendDir, $pythonExe, $env:DATABASE_URL

Set-Location $frontendDir
try {
    npm.cmd run dev -- --host
} finally {
    Stop-Job -Job $backendJob -ErrorAction SilentlyContinue
    Remove-Job -Job $backendJob -Force -ErrorAction SilentlyContinue
}
