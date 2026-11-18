// Initial targets from the project brief. Treat as baselines, not guarantees.
export const thresholds = {
  http_req_failed: ['rate<0.01'],
  http_req_duration: ['p(95)<500', 'p(99)<1000'],
  checks: ['rate>0.99'],
  api_error_rate: ['rate<0.01'],
};
