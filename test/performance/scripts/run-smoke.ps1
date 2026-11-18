[CmdletBinding()]
param([string]$BaseUrl = 'http://127.0.0.1:3000/api/v1')
& $PSScriptRoot\run-k6.ps1 -Scenario smoke -BaseUrl $BaseUrl -VUs 1 -Duration '1s'
exit $LASTEXITCODE
