param([string] $BaseUrl = $(if ($env:K6_BASE_URL) { $env:K6_BASE_URL } else { 'http://localhost:3000' }), [int] $VUs = 1, [string] $Duration = '30s')
& (Join-Path $PSScriptRoot 'run.ps1') -Scenario api -BaseUrl $BaseUrl -VUs $VUs -Duration $Duration
