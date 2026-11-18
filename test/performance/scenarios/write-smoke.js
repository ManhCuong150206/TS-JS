import { check, fail } from 'k6';
import { loginOnce } from '../utils/auth.js';
import { get, post, remove } from '../utils/requests.js';

const enabled = __ENV.K6_ALLOW_WRITES === 'true';
const prefix = __ENV.K6_TEST_PREFIX;
export const options = { vus: 1, iterations: 1, thresholds: { checks: ['rate==1'] } };
export function setup() {
  if (!enabled || !prefix) fail('Write test is disabled. Set K6_ALLOW_WRITES=true and a unique K6_TEST_PREFIX; use a dedicated test account/database only.');
  return loginOnce();
}
export default function (data) {
  if (!data.authenticated) fail('Write test needs K6_TEST_EMAIL and K6_TEST_PASSWORD.');
  const id = `${prefix}-dataset-${Date.now()}`;
  const created = post('/datasets', { clientId: id, name: id, sourceType: 'generated' }, 'POST /datasets', data.cookie);
  check(created, { 'dataset create returned 201': (r) => r.status === 201 });
  if (created.status !== 201) return;
  const datasetId = created.json('_id');
  if (!datasetId) fail('Create response has no _id; refusing cleanup because target is unknown.');
  get(`/datasets/${datasetId}`, 'GET /datasets/:id', data.cookie);
  // Cleanup is deliberately limited to the ID returned by this test only.
  const deleted = remove(`/datasets/${datasetId}`, 'DELETE /datasets/:id', data.cookie);
  check(deleted, { 'dataset cleanup returned 200': (r) => r.status === 200 });
}
