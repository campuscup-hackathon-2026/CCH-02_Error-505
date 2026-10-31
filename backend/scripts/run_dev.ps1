# Run backend and frontend from the backend folder.
# Usage: from backend/, run .\scripts\run_dev.ps1

$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$backendDir = Join-Path $repoRoot 'backend'
$frontendDir = Join-Path $repoRoot 'frontend'
$venvActivate = Join-Path $backendDir '.venv\Scripts\Activate.ps1'

if (Test-Path $venvActivate) {
    & $venvActivate
} else {
    Write-Host 'backend/.venv not found. Create it first with Python 3.14 or 3.11, then install requirements.' -ForegroundColor Yellow
}

if (-not $env:DATABASE_URL) {
    $env:DATABASE_URL = 'sqlite:///./dev.db'
}

Write-Host "Using DATABASE_URL=$env:DATABASE_URL"

Start-Job -Name SentinelBackend -ScriptBlock {
    param($backendDir, $databaseUrl, $chatgptKey, $openaiKey, $geminiKey)
    Set-Location $backendDir
    $env:DATABASE_URL = $databaseUrl
    $env:CHATGPT_API_KEY = $chatgptKey
    $env:OPENAI_API_KEY = $openaiKey
    $env:GEMINI_API_KEY = $geminiKey
    & .\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
} -ArgumentList $backendDir, $env:DATABASE_URL, $env:CHATGPT_API_KEY, $env:OPENAI_API_KEY, $env:GEMINI_API_KEY | Out-Null

Set-Location $frontendDir
npm run dev -- --host
