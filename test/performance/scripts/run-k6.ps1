[CmdletBinding()]
param(
  [ValidateSet('smoke', 'baseline', 'api', 'load', 'stress', 'spike', 'soak', 'write-smoke')]
  [string]$Scenario = 'smoke',
  [string]$BaseUrl = $(if ($env:K6_BASE_URL) { $env:K6_BASE_URL } else { 'http://127.0.0.1:3000/api/v1' }),
  [int]$VUs = 5,
  [string]$Duration = '30s'
)

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..\\..\\..')
$scenarioFile = Join-Path $root "test\\performance\\scenarios\\$Scenario.js"
$reports = Join-Path $root 'test\\performance\\reports'
if (-not (Get-Command k6 -ErrorAction SilentlyContinue)) { throw 'Không tìm thấy k6 trong PATH. Cài k6 rồi mở PowerShell mới: winget install -e --id Grafana.k6' }
if (-not (Test-Path $scenarioFile)) { throw "Không tìm thấy scenario: $scenarioFile" }

try {
  $health = Invoke-WebRequest -Uri "$($BaseUrl.TrimEnd('/'))/health" -UseBasicParsing -TimeoutSec 5
  if ($health.StatusCode -ne 200) { throw "Health trả HTTP $($health.StatusCode)" }
} catch { throw "Backend chưa sẵn sàng tại $BaseUrl. Khởi động API/MongoDB trước. Chi tiết: $($_.Exception.Message)" }

New-Item -ItemType Directory -Force -Path $reports | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$baseName = "$Scenario-$stamp"
$summaryPath = Join-Path $reports "$baseName-summary.json"
$env:K6_BASE_URL = $BaseUrl
$env:K6_VUS = "$VUs"
$env:K6_DURATION = $Duration

Write-Host "Running $Scenario against $BaseUrl (VUs=$VUs, duration=$Duration)"
& k6 run --summary-export $summaryPath --out "json=$(Join-Path $reports "$baseName-raw.json")" $scenarioFile 2>&1 | Tee-Object -FilePath (Join-Path $reports "$baseName.log")
$k6ExitCode = $LASTEXITCODE
# k6 includes the setup return value in --summary-export. The cookie is only an
# in-memory transport between setup and VUs; never persist it in a report.
if (Test-Path $summaryPath) {
  $summary = Get-Content -Raw -LiteralPath $summaryPath | ConvertFrom-Json
  if ($summary.setup_data) {
    $summary.setup_data.PSObject.Properties.Remove('cookie')
    $summary | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $summaryPath -Encoding utf8
  }
}
if ($k6ExitCode -ne 0) { throw "k6 $Scenario failed. Xem $reports\\$baseName.log" }
Write-Host "PASS: raw JSON, summary JSON, and log saved under test/performance/reports/$baseName-*"
