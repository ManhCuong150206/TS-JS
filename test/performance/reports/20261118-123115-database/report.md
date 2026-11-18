# k6 Performance Report

- Scenario: database
- Timestamp: 2026-11-18T12:31:36.5510118+07:00
- Base URL: http://localhost:3000
- Measured duration (s): 16.09
- Peak VUs: 1
- Authentication: temporary test account; secrets omitted
- Write/delete requests: included; dataset documents are soft-deleted and account is cleaned by wrapper
- Total requests: 312
- Throughput (RPS): 20.08
- Average (ms): 9.49
- Median (ms): 7.67
- P90 (ms): 13.69
- P95 (ms): 15.62
- P99 (ms): 20.11
- HTTP request failure rate: 0%
- Check success rate: 100%
- HTTP statuses: 2xx=312, 4xx=0, 5xx=0
- Slowest measured API by p95: auth_login (314.49 ms p95)
- Highest measured API error rate: none (0% across measured APIs)
- k6 exit code: 0
- Status: PASS (thresholds met)

## Per-endpoint latency (milliseconds)

| Endpoint | Avg | P95 | P99 | Error rate |
| --- | ---: | ---: | ---: | ---: |
| auth_login | 314.49 | 314.49 | 314.49 | 0% |
| auth_logout | 15.4 | 15.4 | 15.4 | 0% |
| users_me | 7.58 | 13.01 | 16.34 | 0% |
| datasets_list | 9.43 | 15.21 | 21.79 | 0% |
| datasets_create | 8.75 | 18.1 | 19.39 | 0% |
| datasets_delete | 8.83 | 15.27 | 20.41 | 0% |
| dataset_detail | 7.86 | 13.84 | 18.33 | 0% |

Raw time series: `raw.json`. k6 summary: `summary.json`. Console log: `k6.log`.
Windows process samples and MongoDB snapshots are appended by the wrapper when available.
HTTP response duration is not an isolated measurement of MongoDB query duration.

## Fixture setup and cleanup

- Temporary account registration latency (one setup request): 436.38 ms.
- Bootstrap login latency used to retain a cleanup session: 315.19 ms.
- Account cleanup: PASS via DELETE /api/v1/users/me.
- Dataset records are created with a unique k6 clientId, read, then soft-deleted. Account deletion also soft-deletes any remaining owned dataset/experiment/training-run documents.
- Auth/audit events are application side-effects and may remain in the audit collection; no direct database cleanup was performed.
- Credentials and session cookies are omitted from this report.
- External Windows samples: 8; CPU avg/max=25.97%/31.95%; RAM available min=831 MB.
- Process working set ranges: all Node processes 239.7-308 MB; mongod 56.4-57 MB. Node total is not backend-only.
- Raw external samples: `resource-samples.json`; process metrics are sampled once per second while the k6 process runs.
- MongoDB serverStatus snapshots (version 9.0.4); connections current/active before→after: 12/3 → 12/3; rejected before→after: 0 → 0.
- MongoDB resident memory before→after: 55 → 57 MB; counters are cumulative and include serverStatus sampling commands.
- MongoDB snapshot JSON is recorded in `mongo-snapshots.json`; this is monitoring data, not an isolated database benchmark.
