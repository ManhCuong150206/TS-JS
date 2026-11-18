[CmdletBinding()]
param(
  [string] $BaseUrl = $(if ($env:K6_BASE_URL) { $env:K6_BASE_URL } else { 'http://localhost:3000' }),
  [ValidateRange(1, 3)] [int] $VUs = 1,
  [ValidatePattern('^([1-5][0-9]?|60)s$')] [string] $Duration = '15s',
  [switch] $ConfirmTestDataWrites
)

$ErrorActionPreference = 'Stop'

function Get-MongoSnapshot {
  $probe = "require('dotenv').config({quiet:true}); const m=require('mongoose'); (async()=>{await m.connect(process.env.connection_string); const s=await m.connection.db.admin().command({serverStatus:1}); console.log(JSON.stringify({version:s.version,connections:s.connections,opcounters:s.opcounters,residentMB:s.mem.resident,uptimeSeconds:s.uptime})); await m.disconnect()})().catch(e=>{console.error(e.name); process.exitCode=1})"
  $output = & node -e $probe 2>$null
  if ($LASTEXITCODE -ne 0) { return $null }
  $json = $output | Where-Object { ([string]$_).TrimStart().StartsWith('{') } | Select-Object -Last 1
  if (-not $json) { return $null }
  try { return ([string]$json | ConvertFrom-Json) } catch { return $null }
}
if (-not $ConfirmTestDataWrites) {
  throw 'Tạo/dọn dữ liệu cần truyền -ConfirmTestDataWrites sau khi xác nhận database test cô lập.'
}

$baseUri = $null
if (-not [Uri]::TryCreate($BaseUrl, [UriKind]::Absolute, [ref] $baseUri) -or
  $baseUri.Scheme -notin @('http', 'https') -or
  $baseUri.UserInfo -or
  $baseUri.Host -notin @('localhost', '127.0.0.1', '::1') -or
  $baseUri.AbsolutePath -ne '/' -or $baseUri.Query -or $baseUri.Fragment) {
  throw 'Chỉ cho phép BaseUrl HTTP(S) localhost/loopback, không chứa credentials/path.'
}

if (-not (Get-Command k6 -ErrorAction SilentlyContinue)) {
  throw 'Không tìm thấy k6 trong PATH.'
}

$apiRoot = "$($BaseUrl.TrimEnd('/'))/api/v1"
$health = Invoke-RestMethod -Method Get -Uri "$apiRoot/health" -TimeoutSec 5
if ($health.status -ne 'ok') { throw 'Health preflight không trả status=ok.' }

$mongoConnection = $env:connection_string
if (-not $mongoConnection -and (Test-Path -LiteralPath '.env')) {
  foreach ($line in Get-Content -LiteralPath '.env') {
    if ($line -match '^\s*connection_string\s*=\s*(.*)\s*$') {
      $mongoConnection = $matches[1].Trim().Trim([char]34, [char]39)
      break
    }
  }
}
$mongoUri = $null
if (-not $mongoConnection -or -not [Uri]::TryCreate($mongoConnection, [UriKind]::Absolute, [ref]$mongoUri) -or
  $mongoUri.Scheme -notin @('mongodb', 'mongodb+srv') -or
  $mongoUri.Host -notin @('localhost', '127.0.0.1', '::1')) {
  throw 'Database profile dừng: connection_string phải trỏ tới MongoDB localhost/loopback.'
}

$email = 'k6-run-' + [guid]::NewGuid().ToString('N') + '@example.invalid'
$randomBytes = New-Object byte[] 24
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($randomBytes)
$password = [BitConverter]::ToString($randomBytes).Replace('-', '')
$headers = @{ Accept = 'application/json'; 'X-Requested-With' = 'XMLHttpRequest' }
$webSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$registered = $false
$authenticated = $false
$cleanupSucceeded = $false
$registrationMs = $null
$bootstrapLoginMs = $null
$runId = Get-Date -Format 'yyyyMMdd-HHmmss'
$runId = "$runId-database"
$reportDir = Join-Path (Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path "test/performance/reports/$runId"
$monitorStop = Join-Path $reportDir 'resource-monitor.stop'
$monitorJob = $null
$resourceSamples = @()
$mongoBefore = $null
$mongoAfter = $null
$previousPerfEmail = $env:PERF_TEST_EMAIL
$previousPerfPassword = $env:PERF_TEST_PASSWORD
$previousAllowWrites = $env:PERF_ALLOW_TEST_WRITES
$previousRunId = $env:PERF_RUN_ID

try {
  $registrationBody = @{
    email = $email
    password = $password
    displayName = 'k6 disposable test account'
  } | ConvertTo-Json -Compress
  $timer = [Diagnostics.Stopwatch]::StartNew()
  $user = Invoke-RestMethod -Method Post -Uri "$apiRoot/auth/register" -Headers $headers -ContentType 'application/json' -Body $registrationBody -WebSession $webSession -TimeoutSec 15
  $timer.Stop()
  $registrationMs = [math]::Round($timer.Elapsed.TotalMilliseconds, 2)
  if (-not $user._id -or $user.role -ne 'user') { throw 'Registration did not return a disposable user.' }
  $registered = $true

  $timer.Restart()
  $authenticated = Invoke-RestMethod -Method Post -Uri "$apiRoot/auth/login" -Headers $headers -ContentType 'application/json' -Body (@{ email = $email; password = $password } | ConvertTo-Json -Compress) -WebSession $webSession -TimeoutSec 15
  $timer.Stop()
  $bootstrapLoginMs = [math]::Round($timer.Elapsed.TotalMilliseconds, 2)
  if (-not $authenticated._id -or $authenticated._id -ne $user._id) { throw 'Bootstrap login did not authenticate the created test account.' }
  $authenticated = $true

  $env:PERF_TEST_EMAIL = $email
  $env:PERF_TEST_PASSWORD = $password
  $env:PERF_ALLOW_TEST_WRITES = 'YES'
  $env:PERF_RUN_ID = $runId
  New-Item -ItemType Directory -Path $reportDir -Force | Out-Null
  $mongoBefore = Get-MongoSnapshot
  $monitorJob = Start-Job -ArgumentList $monitorStop -ScriptBlock {
    param($stopPath)
    $ErrorActionPreference = 'SilentlyContinue'
    $samples = @()
    while (-not (Test-Path -LiteralPath $stopPath)) {
      $cpu = $null
      $availableMB = $null
      try {
        $counter = Get-Counter -Counter '\Processor(_Total)\% Processor Time','\Memory\Available MBytes' -MaxSamples 1
        foreach ($reading in $counter.CounterSamples) {
          if ($reading.Path -match 'processor') { $cpu = [double]$reading.CookedValue }
          elseif ($reading.Path -match 'available mbytes') { $availableMB = [double]$reading.CookedValue }
        }
      } catch { }
      $node = @(Get-Process -Name node)
      $mongo = @(Get-Process -Name mongod)
      $samples += [pscustomobject]@{
        timestamp = (Get-Date).ToString('o')
        cpuTotalPercent = $cpu
        availableMemoryMB = $availableMB
        nodeProcessCount = $node.Count
        nodeWorkingSetMB = [math]::Round((($node | Measure-Object WorkingSet64 -Sum).Sum / 1MB), 2)
        mongoWorkingSetMB = [math]::Round((($mongo | Measure-Object WorkingSet64 -Sum).Sum / 1MB), 2)
      }
      Start-Sleep -Seconds 1
    }
    $samples
  }
  Write-Host "Running authenticated database API scenario at $BaseUrl with $VUs VU(s) for $Duration."
  & (Join-Path $PSScriptRoot 'run.ps1') -Scenario database -BaseUrl $BaseUrl -VUs $VUs -Duration $Duration
} finally {
  $mongoAfter = Get-MongoSnapshot
  if ($monitorJob) {
    New-Item -ItemType File -Path $monitorStop -Force | Out-Null
    $resourceSamples = @(Receive-Job -Job $monitorJob -Wait)
    Remove-Job -Job $monitorJob -Force
    Remove-Item -LiteralPath $monitorStop -Force -ErrorAction SilentlyContinue
    if (Test-Path -LiteralPath $reportDir) {
      $resourceSamples | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 -LiteralPath (Join-Path $reportDir 'resource-samples.json')
    }
  }
  if ($registered) {
    try {
      if (-not $authenticated) {
        $null = Invoke-RestMethod -Method Post -Uri "$apiRoot/auth/login" -Headers $headers -ContentType 'application/json' -Body (@{ email = $email; password = $password } | ConvertTo-Json -Compress) -WebSession $webSession -TimeoutSec 15
        $authenticated = $true
      }
      if (-not $authenticated) { throw 'Could not establish cleanup session.' }
      $timer = [Diagnostics.Stopwatch]::StartNew()
      $result = Invoke-RestMethod -Method Delete -Uri "$apiRoot/users/me" -Headers $headers -ContentType 'application/json' -Body (@{ password = $password } | ConvertTo-Json -Compress) -WebSession $webSession -TimeoutSec 20
      $timer.Stop()
      $cleanupSucceeded = $result.success -eq $true
      if (-not $cleanupSucceeded) { Write-Warning 'Temporary account cleanup API did not confirm success.' }
      else { Write-Host "Temporary account and owned documents cleaned through API in $([math]::Round($timer.Elapsed.TotalMilliseconds,2)) ms." }
    } catch {
      $statusCode = 0
      try { $statusCode = [int]$_.Exception.Response.StatusCode } catch { }
      $userId = if ($user -and $user._id) { $user._id } else { 'unknown' }
      Write-Warning "Temporary account cleanup failed (HTTP $statusCode); user ID $userId. Do not rerun writes until this account is cleaned. No password or cookie was logged."
    }
  } else {
    $cleanupSucceeded = $true
  }

  if (Test-Path -LiteralPath $reportDir) {
    $cleanupLabel = if ($cleanupSucceeded) { 'PASS via DELETE /api/v1/users/me' } elseif ($registered) { 'FAIL; inspect runner output before retrying' } else { 'NOT NEEDED (account was not registered)' }
    $lines = @(
      '',
      '## Fixture setup and cleanup',
      '',
      "- Temporary account registration latency (one setup request): $registrationMs ms.",
      "- Bootstrap login latency used to retain a cleanup session: $bootstrapLoginMs ms.",
      "- Account cleanup: $cleanupLabel.",
      '- Dataset records are created with a unique k6 clientId, read, then soft-deleted. Account deletion also soft-deletes any remaining owned dataset/experiment/training-run documents.',
      '- Auth/audit events are application side-effects and may remain in the audit collection; no direct database cleanup was performed.',
      '- Credentials and session cookies are omitted from this report.'
    )
    if ($resourceSamples.Count -gt 0) {
      $cpuValues = @($resourceSamples | Where-Object { $null -ne $_.cpuTotalPercent } | ForEach-Object { [double]$_.cpuTotalPercent })
      $memoryValues = @($resourceSamples | Where-Object { $null -ne $_.availableMemoryMB } | ForEach-Object { [double]$_.availableMemoryMB })
      $nodeValues = @($resourceSamples | ForEach-Object { [double]$_.nodeWorkingSetMB })
      $mongoValues = @($resourceSamples | ForEach-Object { [double]$_.mongoWorkingSetMB })
      $nodeMin = [math]::Round(($nodeValues | Measure-Object -Minimum).Minimum, 1)
      $nodeMax = [math]::Round(($nodeValues | Measure-Object -Maximum).Maximum, 1)
      $mongoMin = [math]::Round(($mongoValues | Measure-Object -Minimum).Minimum, 1)
      $mongoMax = [math]::Round(($mongoValues | Measure-Object -Maximum).Maximum, 1)
      $lines += @(
        "- External Windows samples: $($resourceSamples.Count); CPU avg/max=$([math]::Round(($cpuValues | Measure-Object -Average).Average,2))%/$([math]::Round(($cpuValues | Measure-Object -Maximum).Maximum,2))%; RAM available min=$([math]::Round(($memoryValues | Measure-Object -Minimum).Minimum,0)) MB.",
        "- Process working set ranges: all Node processes $nodeMin-$nodeMax MB; mongod $mongoMin-$mongoMax MB. Node total is not backend-only.",
        '- Raw external samples: `resource-samples.json`; process metrics are sampled once per second while the k6 process runs.'
      )
    }
    if ($mongoBefore -and $mongoAfter) {
      $lines += @(
        "- MongoDB serverStatus snapshots (version $($mongoAfter.version)); connections current/active before→after: $($mongoBefore.connections.current)/$($mongoBefore.connections.active) → $($mongoAfter.connections.current)/$($mongoAfter.connections.active); rejected before→after: $($mongoBefore.connections.rejected) → $($mongoAfter.connections.rejected).",
        "- MongoDB resident memory before→after: $($mongoBefore.residentMB) → $($mongoAfter.residentMB) MB; counters are cumulative and include serverStatus sampling commands.",
        '- MongoDB snapshot JSON is recorded in `mongo-snapshots.json`; this is monitoring data, not an isolated database benchmark.'
      )
      @{ before = $mongoBefore; after = $mongoAfter } | ConvertTo-Json -Depth 6 | Set-Content -Encoding UTF8 -LiteralPath (Join-Path $reportDir 'mongo-snapshots.json')
    }
    Add-Content -Encoding UTF8 -LiteralPath (Join-Path $reportDir 'report.md') -Value ($lines -join [Environment]::NewLine)
  }

  if ($null -eq $previousPerfEmail) { Remove-Item Env:PERF_TEST_EMAIL -ErrorAction SilentlyContinue } else { $env:PERF_TEST_EMAIL = $previousPerfEmail }
  if ($null -eq $previousPerfPassword) { Remove-Item Env:PERF_TEST_PASSWORD -ErrorAction SilentlyContinue } else { $env:PERF_TEST_PASSWORD = $previousPerfPassword }
  if ($null -eq $previousAllowWrites) { Remove-Item Env:PERF_ALLOW_TEST_WRITES -ErrorAction SilentlyContinue } else { $env:PERF_ALLOW_TEST_WRITES = $previousAllowWrites }
  if ($null -eq $previousRunId) { Remove-Item Env:PERF_RUN_ID -ErrorAction SilentlyContinue } else { $env:PERF_RUN_ID = $previousRunId }
  $rng.Dispose()
}

if (-not $cleanupSucceeded) { throw 'Temporary account cleanup was not confirmed.' }
Write-Host "PASS: database API profile completed and cleanup was confirmed. Report: $(Join-Path $reportDir 'report.md')"
