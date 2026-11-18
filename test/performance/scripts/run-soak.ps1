param([string] $BaseUrl = $(if ($env:K6_BASE_URL) { $env:K6_BASE_URL } else { 'http://localhost:3000' }), [int] $VUs = 10, [string] $Duration = '30m', [switch] $ConfirmHighLoad)
if (-not $ConfirmHighLoad) { throw 'Soak cần truyền -ConfirmHighLoad để xác nhận rõ ràng.' }
& (Join-Path $PSScriptRoot 'run.ps1') -Scenario soak -BaseUrl $BaseUrl -VUs $VUs -Duration $Duration -ConfirmHighLoad
