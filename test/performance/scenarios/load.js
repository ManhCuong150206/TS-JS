import { sleep } from 'k6';
import { loginOnce } from '../utils/auth.js';
import { get } from '../utils/requests.js';

export const options = {
  stages: [
    { duration: '15s', target: Number(__ENV.K6_LOAD_VUS_1 || 10) },
    { duration: '30s', target: Number(__ENV.K6_LOAD_VUS_2 || 25) },
    { duration: '30s', target: Number(__ENV.K6_LOAD_VUS_3 || 50) },
    { duration: '15s', target: 0 },
  ],
  thresholds: { http_req_failed: ['rate<0.02'], http_req_duration: ['p(95)<2000'] },
};
export function setup() { return loginOnce(); }
export default function (data) {
  get('/health', 'GET /health');
  if (data.authenticated) get('/experiments?page=1&limit=20', 'GET /experiments', data.cookie);
  sleep(1);
}
