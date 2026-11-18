import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { thresholds } from '../config/thresholds.js';

const baseUrl = (__ENV.PERF_BASE_URL || 'http://localhost:3000').replace(
  /\/+$/,
  '',
);
const vus = positiveInt(__ENV.PERF_VUS, 1, 'PERF_VUS');
const duration = __ENV.PERF_DURATION || '15s';
const email = __ENV.PERF_TEST_EMAIL || '';
const password = __ENV.PERF_TEST_PASSWORD || '';
const apiRoot = '/api/v1';
const endpointNames = [
  'auth_login',
  'users_me',
  'datasets_list',
  'datasets_create',
  'dataset_detail',
  'datasets_delete',
  'auth_logout',
];
const apiLatency = new Trend('api_response_time', true);
const apiErrorRate = new Rate('api_error_rate');
const endpointLatency = Object.fromEntries(
  endpointNames.map((name) => [name, new Trend(`api_latency_${name}`, true)]),
);
const endpointErrors = Object.fromEntries(
  endpointNames.map((name) => [name, new Rate(`api_errors_${name}`)]),
);
const apiStatus = new Counter('api_http_status');
const status2xx = new Counter('api_status_2xx');
const status4xx = new Counter('api_status_4xx');
const status5xx = new Counter('api_status_5xx');
const createdDatasets = new Counter('test_datasets_created');
const deletedDatasets = new Counter('test_datasets_deleted');

if (!email || !password) {
  throw new Error(
    'Database k6 profile chỉ chạy qua run-database.ps1 để cấp fixture an toàn.',
  );
}

export const options = {
  scenarios: {
    api: {
      executor: 'constant-vus',
      vus,
      duration,
    },
  },
  thresholds,
  summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  tags: { test_profile: 'database' },
};

export function setup() {
  const response = http.post(
    `${baseUrl}${apiRoot}/auth/login`,
    JSON.stringify({ email, password }),
    { headers: jsonHeaders(), tags: { endpoint: 'auth_login' } },
  );
  const user = parseJson(response);
  const cookieValue = response.cookies?.['hq3d.sid']?.[0]?.value;
  const valid =
    response.status === 200 &&
    typeof user?._id === 'string' &&
    typeof cookieValue === 'string' &&
    cookieValue.length > 0;
  record('auth_login', response, valid);
  if (!valid)
    throw new Error('Test account login failed; details are redacted.');
  return { cookie: `hq3d.sid=${cookieValue}` };
}

export default function (setupData) {
  const headers = { ...jsonHeaders(), Cookie: setupData.cookie };
  const me = http.get(`${baseUrl}${apiRoot}/users/me`, {
    headers,
    tags: { endpoint: 'users_me' },
  });
  const meBody = parseJson(me);
  record('users_me', me, me.status === 200 && typeof meBody?._id === 'string');

  const list = http.get(`${baseUrl}${apiRoot}/datasets?page=1&limit=10`, {
    headers,
    tags: { endpoint: 'datasets_list' },
  });
  const listBody = parseJson(list);
  record(
    'datasets_list',
    list,
    list.status === 200 &&
      Array.isArray(listBody?.items) &&
      Number.isFinite(listBody?.total),
  );

  const clientId = `k6-${Date.now()}-${__VU}-${__ITER}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
  const create = http.post(
    `${baseUrl}${apiRoot}/datasets`,
    JSON.stringify({
      clientId,
      name: `k6 disposable ${__VU}-${__ITER}`,
      sourceType: 'generated',
      generationConfig: { source: 'k6-performance-test' },
    }),
    { headers, tags: { endpoint: 'datasets_create' } },
  );
  const created = parseJson(create);
  const createValid =
    create.status === 201 &&
    typeof created?._id === 'string' &&
    created.clientId === clientId;
  record('datasets_create', create, createValid);
  if (!createValid) {
    sleep(0.2);
    return;
  }
  createdDatasets.add(1);

  const detail = http.get(
    `${baseUrl}${apiRoot}/datasets/${encodeURIComponent(clientId)}`,
    { headers, tags: { endpoint: 'dataset_detail' } },
  );
  const detailBody = parseJson(detail);
  record(
    'dataset_detail',
    detail,
    detail.status === 200 && detailBody?.clientId === clientId,
  );

  const deletion = http.del(
    `${baseUrl}${apiRoot}/datasets/${encodeURIComponent(clientId)}`,
    null,
    { headers, tags: { endpoint: 'datasets_delete' } },
  );
  const deletionBody = parseJson(deletion);
  const deleteValid = deletion.status === 200 && deletionBody?.success === true;
  record('datasets_delete', deletion, deleteValid);
  if (deleteValid) deletedDatasets.add(1);
  sleep(0.2);
}

export function teardown(setupData) {
  const response = http.post(`${baseUrl}${apiRoot}/auth/logout`, null, {
    headers: {
      ...jsonHeaders(),
      Cookie: setupData.cookie,
      'X-Requested-With': 'XMLHttpRequest',
    },
    tags: { endpoint: 'auth_logout' },
  });
  const body = parseJson(response);
  record(
    'auth_logout',
    response,
    response.status === 200 && body?.success === true,
  );
}

function record(name, response, bodyValid) {
  const statusValid = response.status >= 200 && response.status < 300;
  const failed = !(statusValid && bodyValid);
  apiLatency.add(response.timings.duration, { endpoint: name });
  endpointLatency[name].add(response.timings.duration);
  endpointErrors[name].add(failed);
  apiStatus.add(1, { endpoint: name, status: String(response.status) });
  apiErrorRate.add(failed, { endpoint: name });
  if (statusValid) status2xx.add(1);
  else if (response.status >= 400 && response.status < 500) status4xx.add(1);
  else if (response.status >= 500) status5xx.add(1);
  check(
    response,
    {
      [`${name}: HTTP success`]: () => statusValid,
      [`${name}: expected response`]: () => bodyValid,
    },
    { endpoint: name },
  );
}

function jsonHeaders() {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  };
}

function parseJson(response) {
  try {
    return response.json();
  } catch {
    return null;
  }
}

function positiveInt(raw, fallback, name) {
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return value;
}
