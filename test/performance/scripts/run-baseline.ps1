param([string] $BaseUrl = $(if ($env:K6_BASE_URL) { $env:K6_BASE_URL } else { 'http://localhost:3000' }), [string] $StageDuration = '10s')
$env:K6_STAGE_DURATION = $StageDuration
& (Join-Path $PSScriptRoot 'run.ps1') -Scenario baseline -BaseUrl $BaseUrl
