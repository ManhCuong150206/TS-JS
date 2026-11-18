param([string] $BaseUrl = $(if ($env:K6_BASE_URL) { $env:K6_BASE_URL } else { 'http://localhost:3000' }), [int] $PeakVUs = 50, [string] $Hold = '10s', [switch] $ConfirmHighLoad)
if (-not $ConfirmHighLoad) { throw 'Spike cần truyền -ConfirmHighLoad để xác nhận rõ ràng.' }
$env:K6_SPIKE_PEAK = [string]$PeakVUs
$env:K6_SPIKE_HOLD = $Hold
& (Join-Path $PSScriptRoot 'run.ps1') -Scenario spike -BaseUrl $BaseUrl -ConfirmHighLoad
