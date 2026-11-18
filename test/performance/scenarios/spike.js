import { sleep } from 'k6';
import { loginOnce } from '../utils/auth.js';
import { get } from '../utils/requests.js';

export const options = {
  stages: [
    { duration: '20s', target: 5 },
    { duration: '10s', target: Number(__ENV.K6_SPIKE_VUS_1 || 50) },
    { duration: '20s', target: Number(__ENV.K6_SPIKE_VUS_2 || 100) },
    { duration: '10s', target: 5 },
    { duration: '20s', target: 5 },
    { duration: '10s', target: 0 },
  ],
  thresholds: { http_req_failed: ['rate<0.05'] },
};
export function setup() { return loginOnce(); }
export default function (data) {
  get('/health', 'GET /health');
  if (data.authenticated) get('/datasets?page=1&limit=20', 'GET /datasets', data.cookie);
  sleep(1);
}
