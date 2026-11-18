[CmdletBinding()]
param(
  [string]$BaseUrl = 'http://127.0.0.1:3000/api/v1',
  [int]$VUs = 5,
  [string]$Duration = '30s'
)

$ErrorActionPreference = 'Stop'
# Deliberately excludes stress, spike, soak and write tests to avoid surprise load or data mutation.
foreach ($scenario in @('smoke', 'baseline', 'api', 'load')) {
  Write-Host "`n=== $scenario ==="
  & $PSScriptRoot\run-k6.ps1 -Scenario $scenario -BaseUrl $BaseUrl -VUs $VUs -Duration $Duration
  if ($LASTEXITCODE -ne 0) { throw "Dừng tại scenario $scenario" }
}
