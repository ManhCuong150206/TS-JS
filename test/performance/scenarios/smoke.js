import { check } from 'k6';
import { get } from '../utils/requests.js';

export const options = { vus: 1, iterations: 1, thresholds: { checks: ['rate==1'] } };
export default function () {
  const response = get('/health', 'GET /health');
  check(response, { 'health body reports ok': (r) => r.json('status') === 'ok' });
}
