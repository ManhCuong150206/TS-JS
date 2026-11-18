# k6 Performance Report

- Scenario: soak
- Timestamp: 2026-11-18T12:31:05.8999824+07:00
- Base URL: http://localhost:3000
- Measured duration (s): 1800.79
- Peak VUs: 10
- Authentication: public routes only
- Write/delete requests: not included
- Total requests: 175512
- Throughput (RPS): 97.5
- Average (ms): 1.83
- Median (ms): 1.25
- P90 (ms): 3.31
- P95 (ms): 4.54
- P99 (ms): 9.16
- HTTP request failure rate: 0%
- Check success rate: 100%
- HTTP statuses: 2xx=175512, 4xx=0, 5xx=0
- Slowest measured API by p95: root (4.76 ms p95)
- Highest measured API error rate: none (0% across measured APIs)
- k6 exit code: 0
- Status: PASS (thresholds met)

## Per-endpoint latency (milliseconds)

| Endpoint | Avg | P95 | P99 | Error rate |
| --- | ---: | ---: | ---: | ---: |
| root | 1.91 | 4.76 | 9.32 | 0% |
| health | 1.76 | 4.28 | 8.91 | 0% |

Raw time series: `raw.json`. k6 summary: `summary.json`. Console log: `k6.log`.
System CPU/RAM and MongoDB metrics were not sampled by this profile.
HTTP response duration is not an isolated measurement of MongoDB query duration.
