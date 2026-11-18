export const baseUrl = (__ENV.K6_BASE_URL || 'http://127.0.0.1:3000/api/v1').replace(/\/$/, '');
export const vus = Number(__ENV.K6_VUS || 5);
export const duration = __ENV.K6_DURATION || '30s';
export const testEmail = __ENV.K6_TEST_EMAIL;
export const testPassword = __ENV.K6_TEST_PASSWORD;

export function hasCredentials() {
  return Boolean(testEmail && testPassword);
}

export function jsonHeaders(cookie) {
  return {
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
    },
  };
}
