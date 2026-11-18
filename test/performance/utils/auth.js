import http from 'k6/http';
import { check, fail } from 'k6';
import { baseUrl, hasCredentials, jsonHeaders, testEmail, testPassword } from './config.js';

// setup() runs once per whole k6 test, avoiding the login rate limiter per VU.
export function loginOnce() {
  if (!hasCredentials()) return { authenticated: false };
  const response = http.post(`${baseUrl}/auth/login`, JSON.stringify({ email: testEmail, password: testPassword }), {
    ...jsonHeaders(),
    headers: { ...jsonHeaders().headers, 'X-Requested-With': 'XMLHttpRequest' },
  });
  const ok = check(response, { 'login setup returned 200': (r) => r.status === 200 });
  if (!ok) fail(`Login setup failed with HTTP ${response.status}. Check K6_TEST_EMAIL/K6_TEST_PASSWORD and the 5 requests/minute auth throttle.`);
  const session = response.cookies['hq3d.sid'] && response.cookies['hq3d.sid'][0];
  if (!session) fail('Login succeeded but hq3d.sid session cookie was not returned.');
  return { authenticated: true, cookie: `hq3d.sid=${session.value}` };
}
