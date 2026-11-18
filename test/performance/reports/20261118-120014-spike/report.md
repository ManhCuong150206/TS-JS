# k6 Performance Report

- Scenario: spike
- Timestamp: 2026-11-18T12:00:50.6539366+07:00
- Base URL: http://localhost:3000
- Measured duration (s): 35.66
- Peak VUs: 50
- Authentication: public routes only
- Write/delete requests: not included
- Total requests: 6118
- Throughput (RPS): 174.09
- Average (ms): 0.93
- Median (ms): 0.79
- P90 (ms): 1.67
- P95 (ms): 1.93
- P99 (ms): 2.8
- HTTP request failure rate: 0%
- Check success rate: 100%
- HTTP statuses: 2xx=6118, 4xx=0, 5xx=0
- Slowest measured API by p95: root (2.02 ms p95)
- Highest measured API error rate: none (0% across measured APIs)
- k6 exit code: 0
- Status: PASS (thresholds met)

## Per-endpoint latency (milliseconds)

| Endpoint | Avg | P95 | P99 | Error rate |
| --- | ---: | ---: | ---: | ---: |
| root | 1.01 | 2.02 | 2.87 | 0% |
| health | 0.84 | 1.86 | 2.79 | 0% |

Raw time series: `raw.json`. k6 summary: `summary.json`. Console log: `k6.log`.
System CPU/RAM and MongoDB metrics were not sampled by this profile.
HTTP response duration is not an isolated measurement of MongoDB query duration.
