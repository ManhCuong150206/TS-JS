import http from 'k6/http';
import { check } from 'k6';
import { baseUrl, jsonHeaders } from './config.js';

export function get(path, label, cookie) {
  const response = http.get(`${baseUrl}${path}`, { tags: { name: label }, ...(cookie ? jsonHeaders(cookie) : {}) });
  check(response, { [`${label}: expected 200`]: (r) => r.status === 200 });
  return response;
}

export function post(path, body, label, cookie) {
  const response = http.post(`${baseUrl}${path}`, JSON.stringify(body), {
    tags: { name: label },
    ...jsonHeaders(cookie),
    headers: { ...jsonHeaders(cookie).headers, 'X-Requested-With': 'XMLHttpRequest' },
  });
  return response;
}

export function remove(path, label, cookie) {
  return http.del(`${baseUrl}${path}`, null, {
    tags: { name: label },
    ...jsonHeaders(cookie),
    headers: { ...jsonHeaders(cookie).headers, 'X-Requested-With': 'XMLHttpRequest' },
  });
}
