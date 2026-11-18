import { sleep } from 'k6';
import { vus, duration } from '../utils/config.js';
import { loginOnce } from '../utils/auth.js';
import { get } from '../utils/requests.js';

export const options = { vus, duration, thresholds: { http_req_failed: ['rate<0.02'], http_req_duration: ['p(95)<1500'] } };
export function setup() { return loginOnce(); }
export default function (data) {
  get('/health', 'GET /health');
  if (data.authenticated) {
    get('/auth/me', 'GET /auth/me', data.cookie);
    get('/datasets?page=1&limit=20', 'GET /datasets', data.cookie);
    get('/experiments?page=1&limit=20', 'GET /experiments', data.cookie);
    get('/training-runs?page=1&limit=20', 'GET /training-runs', data.cookie);
    get('/sync/changes', 'GET /sync/changes', data.cookie);
  }
  sleep(1);
}
