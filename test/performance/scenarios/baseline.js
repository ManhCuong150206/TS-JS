import { sleep } from 'k6';
import { vus } from '../utils/config.js';
import { loginOnce } from '../utils/auth.js';
import { get } from '../utils/requests.js';

export const options = { stages: [{ duration: '10s', target: 1 }, { duration: '20s', target: vus }], thresholds: { http_req_failed: ['rate<0.01'], http_req_duration: ['p(95)<1000'] } };
export function setup() { return loginOnce(); }
export default function (data) {
  get('/health', 'GET /health');
  if (data.authenticated) { get('/auth/me', 'GET /auth/me', data.cookie); get('/experiments?page=1&limit=20', 'GET /experiments', data.cookie); }
  sleep(1);
}
