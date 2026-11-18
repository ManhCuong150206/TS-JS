import { sleep } from 'k6';
import { loginOnce } from '../utils/auth.js';
import { get } from '../utils/requests.js';

export const options = {
  vus: Number(__ENV.K6_SOAK_VUS || 10),
  duration: __ENV.K6_SOAK_DURATION || '30m',
  thresholds: { http_req_failed: ['rate<0.02'], http_req_duration: ['p(95)<2000'] },
};
export function setup() { return loginOnce(); }
export default function (data) {
  get('/health', 'GET /health');
  if (data.authenticated) get('/experiments?page=1&limit=20', 'GET /experiments', data.cookie);
  sleep(1);
}
