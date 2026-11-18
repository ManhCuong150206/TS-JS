# k6 Performance Report

- Scenario: load
- Timestamp: 2026-11-18T11:59:14.8117463+07:00
- Base URL: http://localhost:3000
- Measured duration (s): 25.6
- Peak VUs: 10
- Authentication: public routes only
- Write/delete requests: not included
- Total requests: 1212
- Throughput (RPS): 48.38
- Average (ms): 1.3
- Median (ms): 1.08
- P90 (ms): 2.04
- P95 (ms): 2.67
- P99 (ms): 4.4
- HTTP request failure rate: 0%
- Check success rate: 100%
- HTTP statuses: 2xx=1212, 4xx=0, 5xx=0
- Slowest measured API by p95: root (2.75 ms p95)
- Highest measured API error rate: none (0% across measured APIs)
- k6 exit code: 0
- Status: PASS (thresholds met)

## Per-endpoint latency (milliseconds)

| Endpoint | Avg | P95 | P99 | Error rate |
| --- | ---: | ---: | ---: | ---: |
| root | 1.45 | 2.75 | 4.43 | 0% |
| health | 1.15 | 2.56 | 4.32 | 0% |

Raw time series: `raw.json`. k6 summary: `summary.json`. Console log: `k6.log`.
System CPU/RAM and MongoDB metrics were not sampled by this profile.
HTTP response duration is not an isolated measurement of MongoDB query duration.
