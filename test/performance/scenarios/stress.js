import { sleep } from 'k6';
import { loginOnce } from '../utils/auth.js';
import { get } from '../utils/requests.js';

const max = Number(__ENV.K6_STRESS_MAX_VUS || 50);
const levels = [10, 25, 50, 100, 150, 200].filter((value) => value <= max);
export const options = {
  stages: [...levels.map((target) => ({ duration: __ENV.K6_STRESS_STEP_DURATION || '20s', target })), { duration: '15s', target: 0 }],
  // This cap is intentionally conservative; raise it only after observing safe results.
  maxVUs: max,
  thresholds: { http_req_failed: ['rate<0.05'] },
};
export function setup() { return loginOnce(); }
export default function (data) {
  get('/health', 'GET /health');
  if (data.authenticated) get('/experiments?page=1&limit=20', 'GET /experiments', data.cookie);
  sleep(1);
}
