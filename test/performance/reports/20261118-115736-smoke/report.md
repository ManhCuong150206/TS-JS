# k6 Performance Report

- Scenario: smoke
- Timestamp: 2026-11-18T11:57:42.7669117+07:00
- Base URL: http://localhost:3000
- Measured duration (s): 5.77
- Peak VUs: 1
- Authentication: public routes only
- Write/delete requests: not included
- Total requests: 50
- Throughput (RPS): 9.8
- Average (ms): 1.08
- Median (ms): 1.04
- P90 (ms): 1.86
- P95 (ms): 2.26
- P99 (ms): 2.3
- HTTP request failure rate: 0%
- Check success rate: 100%
- HTTP statuses: 2xx=50, 4xx=0, 5xx=0
- Slowest measured API by p95: health (2.28 ms p95)
- Highest measured API error rate: none (0% across measured APIs)
- k6 exit code: 0
- Status: PASS (thresholds met)

## Per-endpoint latency (milliseconds)

| Endpoint | Avg | P95 | P99 | Error rate |
| --- | ---: | ---: | ---: | ---: |
| root | 1.09 | 1.79 | 2.16 | 0% |
| health | 1.08 | 2.28 | 2.31 | 0% |

Raw time series: `raw.json`. k6 summary: `summary.json`. Console log: `k6.log`.
System CPU/RAM and MongoDB metrics were not sampled by this profile.
HTTP response duration is not an isolated measurement of MongoDB query duration.
