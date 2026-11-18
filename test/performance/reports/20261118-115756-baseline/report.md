# k6 Performance Report

- Scenario: baseline
- Timestamp: 2026-11-18T11:58:32.5588198+07:00
- Base URL: http://localhost:3000
- Measured duration (s): 35.63
- Peak VUs: 10
- Authentication: public routes only
- Write/delete requests: not included
- Total requests: 1296
- Throughput (RPS): 36.96
- Average (ms): 1.66
- Median (ms): 1.05
- P90 (ms): 1.97
- P95 (ms): 2.54
- P99 (ms): 6.63
- HTTP request failure rate: 0%
- Check success rate: 100%
- HTTP statuses: 2xx=1296, 4xx=0, 5xx=0
- Slowest measured API by p95: root (2.7 ms p95)
- Highest measured API error rate: none (0% across measured APIs)
- k6 exit code: 0
- Status: PASS (thresholds met)

## Per-endpoint latency (milliseconds)

| Endpoint | Avg | P95 | P99 | Error rate |
| --- | ---: | ---: | ---: | ---: |
| root | 2.02 | 2.7 | 6.83 | 0% |
| health | 1.31 | 2.26 | 5.69 | 0% |

Raw time series: `raw.json`. k6 summary: `summary.json`. Console log: `k6.log`.
System CPU/RAM and MongoDB metrics were not sampled by this profile.
HTTP response duration is not an isolated measurement of MongoDB query duration.
