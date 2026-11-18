[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('smoke', 'baseline', 'api', 'database', 'load', 'stress', 'spike', 'soak')]
  [string] $Scenario,
  [string] $BaseUrl = $(if ($env:K6_BASE_URL) { $env:K6_BASE_URL } else { 'http://localhost:3000' }),
  [int] $VUs = 0,
  [int] $MaxVUs = 0,
  [string] $Duration = '',
  [switch] $ConfirmHighLoad
)

$ErrorActionPreference = 'Stop'
$baseUri = $null
if (-not [Uri]::TryCreate($BaseUrl, [UriKind]::Absolute, [ref] $baseUri)) {
  throw 'BaseUrl phải là URL tuyệt đối hợp lệ.'
}
if ($baseUri.Scheme -notin @('http', 'https') -or $baseUri.UserInfo) {
  throw 'BaseUrl chỉ được dùng HTTP(S) và không được chứa credentials.'
}
if ($baseUri.Host -notin @('localhost', '127.0.0.1', '::1')) {
  throw 'Chỉ cho phép chạy k6 tới localhost/loopback. Không chạy test trên production.'
}
if ($baseUri.AbsolutePath -ne '/' -or $baseUri.Query -or $baseUri.Fragment) {
  throw 'BaseUrl chỉ chứa scheme, host và port, ví dụ http://localhost:3000.'
}

$k6 = Get-Command k6 -ErrorAction SilentlyContinue
if (-not $k6) { throw 'Không tìm thấy k6 trong PATH. Cài Grafana k6 trước khi chạy.' }

$healthUrl = "$($BaseUrl.TrimEnd('/'))/api/v1/health"
try {
  $health = Invoke-RestMethod -Method Get -Uri $healthUrl -TimeoutSec 5
  if ($health.status -ne 'ok') { throw 'Health response không có status=ok.' }
} catch {
  throw "Backend không sẵn sàng tại $healthUrl; không chạy profile '$Scenario'. $($_.Exception.Message)"
}

$highLoadProfiles = @('stress', 'spike', 'soak')
if ($Scenario -in $highLoadProfiles -and -not $ConfirmHighLoad) {
  throw "Profile '$Scenario' cần -ConfirmHighLoad để chạy tường minh."
}
if ($Scenario -eq 'database' -and $env:PERF_ALLOW_TEST_WRITES -ne 'YES') {
  throw "Profile 'database' có tạo/xóa fixture; chỉ chạy qua run-database.ps1 với -ConfirmTestDataWrites."
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
$scenarioFile = if ($Scenario -eq 'database') {
  Join-Path $PSScriptRoot '../scenarios/database.js'
} else {
  Join-Path $PSScriptRoot '../scenarios/api.js'
}
$reportRoot = Join-Path $repoRoot 'test/performance/reports'
$runId = if ($env:PERF_RUN_ID -and $Scenario -eq 'database') {
  if ($env:PERF_RUN_ID -notmatch '^\d{8}-\d{6}-database$') { throw 'PERF_RUN_ID không hợp lệ.' }
  $env:PERF_RUN_ID
} else {
  '{0}-{1}' -f (Get-Date -Format 'yyyyMMdd-HHmmss'), $Scenario
}
$runDir = Join-Path $reportRoot $runId
New-Item -ItemType Directory -Path $runDir -Force | Out-Null
$rawPath = Join-Path $runDir 'raw.json'
$summaryPath = Join-Path $runDir 'summary.json'
$logPath = Join-Path $runDir 'k6.log'
$markdownPath = Join-Path $runDir 'report.md'

$envArgs = @(
  '-e', "PERF_BASE_URL=$($BaseUrl.TrimEnd('/'))",
  '-e', "PERF_PROFILE=$Scenario"
)
if ($VUs -gt 0) { $envArgs += @('-e', "PERF_VUS=$VUs") }
if ($MaxVUs -gt 0) { $envArgs += @('-e', "PERF_MAX_VUS=$MaxVUs") }
if ($Duration) { $envArgs += @('-e', "PERF_DURATION=$Duration") }
if ($ConfirmHighLoad) { $envArgs += @('-e', 'PERF_CONFIRM_HIGH_LOAD=YES') }

# The cookie is passed to k6 only when supplied by the operator; it is never printed or written to reports.
if ($env:K6_SESSION_COOKIE) { $envArgs += @('-e', "PERF_SESSION_COOKIE=$($env:K6_SESSION_COOKIE)") }
if ($env:K6_DATASET_ID) { $envArgs += @('-e', "PERF_DATASET_ID=$($env:K6_DATASET_ID)") }
if ($env:K6_EXPERIMENT_ID) { $envArgs += @('-e', "PERF_EXPERIMENT_ID=$($env:K6_EXPERIMENT_ID)") }
if ($env:K6_TRAINING_RUN_ID) { $envArgs += @('-e', "PERF_TRAINING_RUN_ID=$($env:K6_TRAINING_RUN_ID)") }
if ($env:K6_STAGE_DURATION) { $envArgs += @('-e', "PERF_STAGE_DURATION=$($env:K6_STAGE_DURATION)") }
if ($env:K6_SPIKE_PEAK) { $envArgs += @('-e', "PERF_SPIKE_PEAK=$($env:K6_SPIKE_PEAK)") }
if ($env:K6_SPIKE_HOLD) { $envArgs += @('-e', "PERF_SPIKE_HOLD=$($env:K6_SPIKE_HOLD)") }
if ($env:K6_TIMEOUT) { $envArgs += @('-e', "PERF_TIMEOUT=$($env:K6_TIMEOUT)") }
if ($Scenario -eq 'database') {
  if (-not $env:PERF_TEST_EMAIL -or -not $env:PERF_TEST_PASSWORD) {
    throw 'Thiếu credentials tạm; chỉ chạy profile database qua run-database.ps1.'
  }
  $envArgs += @('-e', "PERF_TEST_EMAIL=$($env:PERF_TEST_EMAIL)", '-e', "PERF_TEST_PASSWORD=$($env:PERF_TEST_PASSWORD)")
}

Write-Host "Running k6 profile '$Scenario' against localhost. Output: $runDir"
$runStartedAt = Get-Date
$previousErrorPreference = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
& $k6.Source run --out "json=$rawPath" --summary-export $summaryPath @envArgs $scenarioFile 2>&1 |
  Tee-Object -FilePath $logPath
$k6Exit = $LASTEXITCODE
$ErrorActionPreference = $previousErrorPreference

if (Test-Path -LiteralPath $summaryPath) {
  $summary = Get-Content -Raw -LiteralPath $summaryPath | ConvertFrom-Json
  if ($Scenario -eq 'database' -and $summary.PSObject.Properties['setup_data']) {
    if ($summary.setup_data -and $summary.setup_data.PSObject.Properties['cookie']) {
      $summary.setup_data.cookie = '[REDACTED]'
    } else {
      $summary.setup_data = '[REDACTED]'
    }
    Set-Content -Encoding UTF8 -LiteralPath $summaryPath -Value ($summary | ConvertTo-Json -Depth 100)
  }
  $metrics = $summary.metrics
  $durationMetric = $metrics.http_req_duration
  $requestMetric = $metrics.http_reqs
  $failedMetric = $metrics.http_req_failed
  $checksMetric = $metrics.checks
  $vusMetric = $metrics.vus_max
  $routeLines = @()
  $routeRows = @()
  foreach ($endpoint in @('root', 'health', 'auth_login', 'auth_me', 'auth_logout', 'users_me', 'datasets_list', 'datasets_create', 'datasets_delete', 'experiments_list', 'training_runs_list', 'sync_changes', 'dataset_detail', 'dataset_download', 'experiment_detail', 'training_run_detail')) {
    $routeProperty = $metrics.PSObject.Properties["api_latency_$endpoint"]
    if ($routeProperty -and $routeProperty.Value.PSObject.Properties['avg']) {
      $routeMetric = $routeProperty.Value
      $errorProperty = $metrics.PSObject.Properties["api_errors_$endpoint"]
      $errorPercent = if ($errorProperty) { [math]::Round([double]$errorProperty.Value.value * 100, 2) } else { 0 }
      $routeRows += [pscustomobject]@{
        Endpoint = $endpoint
        Average = [double]$routeMetric.avg
        P95 = [double]$routeMetric.'p(95)'
        P99 = [double]$routeMetric.'p(99)'
        Errors = $errorPercent
      }
    }
  }
  foreach ($route in $routeRows) {
    $routeLines += "| $($route.Endpoint) | $([math]::Round($route.Average, 2)) | $([math]::Round($route.P95, 2)) | $([math]::Round($route.P99, 2)) | $($route.Errors)% |"
  }
  $authLabel = if ($Scenario -eq 'database') { 'temporary test account; secrets omitted' } elseif ($env:K6_SESSION_COOKIE) { 'session cookie supplied' } else { 'public routes only' }
  $writeLabel = if ($Scenario -eq 'database') { 'included; dataset documents are soft-deleted and account is cleaned by wrapper' } else { 'not included' }
  $status2xx = if ($metrics.PSObject.Properties['api_status_2xx']) { $metrics.api_status_2xx.count } else { 0 }
  $status4xx = if ($metrics.PSObject.Properties['api_status_4xx']) { $metrics.api_status_4xx.count } else { 0 }
  $status5xx = if ($metrics.PSObject.Properties['api_status_5xx']) { $metrics.api_status_5xx.count } else { 0 }
  $runSeconds = [math]::Round(((Get-Date) - $runStartedAt).TotalSeconds, 2)
  $slowestRoute = $routeRows | Sort-Object P95 -Descending | Select-Object -First 1
  $slowestLabel = if ($slowestRoute) { "$($slowestRoute.Endpoint) ($([math]::Round($slowestRoute.P95, 2)) ms p95)" } else { 'no route measurements' }
  $highestErrorRoute = $routeRows | Sort-Object Errors -Descending | Select-Object -First 1
  $highestErrorLabel = if ($highestErrorRoute -and $highestErrorRoute.Errors -gt 0) { "$($highestErrorRoute.Endpoint) ($($highestErrorRoute.Errors)%)" } else { 'none (0% across measured APIs)' }
  $statusLabel = if ($k6Exit -eq 0) { 'PASS (thresholds met)' } else { 'FAIL (thresholds not met or runtime error)' }
  $resourceNote = if ($Scenario -eq 'database') { 'Windows process samples and MongoDB snapshots are appended by the wrapper when available.' } else { 'System CPU/RAM and MongoDB metrics were not sampled by this profile.' }
  $lines = @(
    '# k6 Performance Report',
    '',
    "- Scenario: $Scenario",
    "- Timestamp: $((Get-Date).ToString('o'))",
    "- Base URL: $($BaseUrl.TrimEnd('/'))",
    "- Measured duration (s): $runSeconds",
    "- Peak VUs: $($vusMetric.max)",
    "- Authentication: $authLabel",
    "- Write/delete requests: $writeLabel",
    "- Total requests: $($requestMetric.count)",
    "- Throughput (RPS): $([math]::Round([double]$requestMetric.rate, 2))",
    "- Average (ms): $([math]::Round([double]$durationMetric.avg, 2))",
    "- Median (ms): $([math]::Round([double]$durationMetric.med, 2))",
    "- P90 (ms): $([math]::Round([double]$durationMetric.'p(90)', 2))",
    "- P95 (ms): $([math]::Round([double]$durationMetric.'p(95)', 2))",
    "- P99 (ms): $([math]::Round([double]$durationMetric.'p(99)', 2))",
    "- HTTP request failure rate: $([math]::Round([double]$failedMetric.value * 100, 3))%",
    "- Check success rate: $([math]::Round([double]$checksMetric.value * 100, 3))%",
    "- HTTP statuses: 2xx=$status2xx, 4xx=$status4xx, 5xx=$status5xx",
    "- Slowest measured API by p95: $slowestLabel",
    "- Highest measured API error rate: $highestErrorLabel",
    "- k6 exit code: $k6Exit",
    "- Status: $statusLabel",
    '',
    '## Per-endpoint latency (milliseconds)',
    '',
    '| Endpoint | Avg | P95 | P99 | Error rate |',
    '| --- | ---: | ---: | ---: | ---: |',
    ($routeLines -join [Environment]::NewLine),
    '',
    'Raw time series: `raw.json`. k6 summary: `summary.json`. Console log: `k6.log`.',
    $resourceNote,
    'HTTP response duration is not an isolated measurement of MongoDB query duration.'
  )
  Set-Content -Encoding UTF8 -LiteralPath $markdownPath -Value ($lines -join [Environment]::NewLine)
}

if ($k6Exit -ne 0) { throw "k6 profile '$Scenario' failed with exit code $k6Exit. See $logPath" }
Write-Host "PASS: '$Scenario'. Report: $markdownPath"
