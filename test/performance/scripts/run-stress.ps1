param([string] $BaseUrl = $(if ($env:K6_BASE_URL) { $env:K6_BASE_URL } else { 'http://localhost:3000' }), [int] $MaxVUs = 50, [string] $StageDuration = '10s', [switch] $ConfirmHighLoad)
if (-not $ConfirmHighLoad) { throw 'Stress cần truyền -ConfirmHighLoad để xác nhận rõ ràng.' }
$env:K6_STAGE_DURATION = $StageDuration
& (Join-Path $PSScriptRoot 'run.ps1') -Scenario stress -BaseUrl $BaseUrl -MaxVUs $MaxVUs -ConfirmHighLoad
