# k6 Performance Report

- Scenario: stress
- Timestamp: 2026-11-18T11:59:59.1460758+07:00
- Base URL: http://localhost:3000
- Measured duration (s): 35.66
- Peak VUs: 50
- Authentication: public routes only
- Write/delete requests: not included
- Total requests: 7594
- Throughput (RPS): 216.72
- Average (ms): 1.13
- Median (ms): 1.03
- P90 (ms): 2.08
- P95 (ms): 2.69
- P99 (ms): 4.69
- HTTP request failure rate: 0%
- Check success rate: 100%
- HTTP statuses: 2xx=7594, 4xx=0, 5xx=0
- Slowest measured API by p95: root (2.71 ms p95)
- Highest measured API error rate: none (0% across measured APIs)
- k6 exit code: 0
- Status: PASS (thresholds met)

## Per-endpoint latency (milliseconds)

| Endpoint | Avg | P95 | P99 | Error rate |
| --- | ---: | ---: | ---: | ---: |
| root | 1.18 | 2.71 | 4.59 | 0% |
| health | 1.08 | 2.66 | 4.92 | 0% |

Raw time series: `raw.json`. k6 summary: `summary.json`. Console log: `k6.log`.
System CPU/RAM and MongoDB metrics were not sampled by this profile.
HTTP response duration is not an isolated measurement of MongoDB query duration.
