/**
 * Quantum Vorvex — k6 Load Test Suite
 *
 * Usage:
 *   k6 run k6/load-test.js                              # runs all scenarios
 *   k6 run --env SCENARIO=smoke k6/load-test.js         # smoke only
 *   k6 run --env BASE_URL=https://api.example.com k6/load-test.js
 *   k6 run --env TEST_EMAIL=admin@example.com --env TEST_PASSWORD=changeme k6/load-test.js
 *
 * Install k6: https://k6.io/docs/getting-started/installation/
 *
 * Environment variables:
 *   BASE_URL       — API base URL (default: http://localhost:5000)
 *   TEST_EMAIL     — Email for login tests (default: admin@quantumvorvex.com)
 *   TEST_PASSWORD  — Password for login tests (default: changeme)
 *   SCENARIO       — Run only a named scenario (smoke|load|stress|spike|auth-flow)
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { SharedArray } from 'k6/data';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';
const TEST_EMAIL = __ENV.TEST_EMAIL || 'admin@quantumvorvex.com';
const TEST_PASSWORD = __ENV.TEST_PASSWORD || 'changeme';
const RUN_SCENARIO = __ENV.SCENARIO || null; // null = run all

// ---------------------------------------------------------------------------
// Custom metrics
// ---------------------------------------------------------------------------
const loginSuccessRate = new Rate('login_success_rate');
const roomFetchSuccessRate = new Rate('room_fetch_success_rate');
const loginDuration = new Trend('login_duration', true);
const roomFetchDuration = new Trend('room_fetch_duration', true);
const authErrors = new Counter('auth_errors');
const apiErrors = new Counter('api_errors');

// ---------------------------------------------------------------------------
// Shared headers
// ---------------------------------------------------------------------------
const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
};

// ---------------------------------------------------------------------------
// Scenario definitions
// ---------------------------------------------------------------------------

const SCENARIOS = {
  /**
   * Smoke test — minimal load, verify basic functionality.
   * 1 VU, 30 seconds, hits /health only.
   */
  smoke: {
    executor: 'constant-vus',
    vus: 1,
    duration: '30s',
    tags: { scenario: 'smoke' },
    env: { SCENARIO_NAME: 'smoke' },
    gracefulStop: '5s',
  },

  /**
   * Load test — realistic sustained load.
   * Ramp 0 → 50 VUs over 2 min, hold 5 min, ramp down over 1 min.
   * Tests GET /api/v1/rooms and GET /health.
   */
  load: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '2m', target: 50 },   // ramp up
      { duration: '5m', target: 50 },   // hold
      { duration: '1m', target: 0 },    // ramp down
    ],
    tags: { scenario: 'load' },
    env: { SCENARIO_NAME: 'load' },
    gracefulRampDown: '30s',
    gracefulStop: '30s',
  },

  /**
   * Stress test — push beyond normal load to find the breaking point.
   * Ramp from 0 → 200 VUs over 5 stages.
   */
  stress: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '2m', target: 50 },   // warm up
      { duration: '2m', target: 100 },  // increasing pressure
      { duration: '2m', target: 150 },  // heavy load
      { duration: '2m', target: 200 },  // stress
      { duration: '2m', target: 0 },    // ramp down
    ],
    tags: { scenario: 'stress' },
    env: { SCENARIO_NAME: 'stress' },
    gracefulRampDown: '30s',
    gracefulStop: '30s',
  },

  /**
   * Spike test — instant jump to 500 VUs for 10s then back to 0.
   * Simulates a sudden traffic surge (e.g. marketing flash sale).
   */
  spike: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '10s', target: 0 },   // baseline
      { duration: '5s',  target: 500 }, // instant spike
      { duration: '10s', target: 500 }, // hold the spike
      { duration: '5s',  target: 0 },   // drop back
      { duration: '10s', target: 0 },   // recovery monitoring
    ],
    tags: { scenario: 'spike' },
    env: { SCENARIO_NAME: 'spike' },
    gracefulRampDown: '10s',
    gracefulStop: '15s',
  },

  /**
   * Auth flow — 10 VUs continuously run the full login → browse → logout flow.
   * Tests the complete authentication lifecycle under concurrent load.
   */
  'auth-flow': {
    executor: 'constant-vus',
    vus: 10,
    duration: '3m',
    tags: { scenario: 'auth-flow' },
    env: { SCENARIO_NAME: 'auth-flow' },
    gracefulStop: '30s',
  },
};

// Filter to a single scenario if requested
const activeScenarios = RUN_SCENARIO
  ? { [RUN_SCENARIO]: SCENARIOS[RUN_SCENARIO] }
  : SCENARIOS;

// ---------------------------------------------------------------------------
// Thresholds
// ---------------------------------------------------------------------------
export const options = {
  scenarios: activeScenarios,

  thresholds: {
    // Overall HTTP request duration
    'http_req_duration': [
      'p(95)<500',    // 95th percentile under 500ms
      'p(99)<2000',   // 99th percentile under 2 seconds
    ],

    // Error rate (non-2xx responses) must be under 1%
    'http_req_failed': ['rate<0.01'],

    // Custom metrics
    'login_success_rate': ['rate>0.95'],      // 95% of logins must succeed
    'room_fetch_success_rate': ['rate>0.99'], // 99% of room fetches must succeed
    'login_duration': ['p(95)<1000'],         // Login p95 under 1 second
    'room_fetch_duration': ['p(95)<400'],     // Room fetch p95 under 400ms

    // Scenario-specific thresholds
    'http_req_duration{scenario:smoke}': ['p(99)<200'],
    'http_req_duration{scenario:load}': ['p(95)<500'],
    'http_req_duration{scenario:auth-flow}': ['p(95)<800'],
  },

  // Summary output
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

// ---------------------------------------------------------------------------
// Helper: log a response error with context
// ---------------------------------------------------------------------------
function logError(tag, response) {
  console.error(
    `[${tag}] ${response.status} ${response.url} — ` +
    `${response.timings.duration.toFixed(0)}ms — ` +
    (response.body ? String(response.body).substring(0, 200) : 'no body'),
  );
}

// ---------------------------------------------------------------------------
// Helper: perform login and return the token (or null on failure)
// ---------------------------------------------------------------------------
function login() {
  const payload = JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD });

  const startTime = Date.now();
  const response = http.post(`${BASE_URL}/api/v1/auth/login`, payload, {
    headers: JSON_HEADERS,
    tags: { operation: 'login' },
  });
  loginDuration.add(Date.now() - startTime);

  const success = check(response, {
    'login: status is 200': (r) => r.status === 200,
    'login: response has token': (r) => {
      try {
        const body = JSON.parse(r.body);
        return !!(body.token || body.accessToken || (body.data && body.data.token));
      } catch {
        return false;
      }
    },
  });

  loginSuccessRate.add(success);

  if (!success) {
    authErrors.add(1);
    logError('login', response);
    return null;
  }

  try {
    const body = JSON.parse(response.body);
    return body.token || body.accessToken || (body.data && body.data.token) || null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Helper: fetch rooms with a bearer token
// ---------------------------------------------------------------------------
function getRooms(token) {
  const startTime = Date.now();
  const response = http.get(`${BASE_URL}/api/v1/rooms`, {
    headers: { ...JSON_HEADERS, 'Authorization': `Bearer ${token}` },
    tags: { operation: 'get-rooms' },
  });
  roomFetchDuration.add(Date.now() - startTime);

  const success = check(response, {
    'rooms: status is 200': (r) => r.status === 200,
    'rooms: response is JSON': (r) => r.headers['Content-Type'] && r.headers['Content-Type'].includes('application/json'),
  });

  roomFetchSuccessRate.add(success);

  if (!success) {
    apiErrors.add(1);
    logError('rooms', response);
  }

  return success;
}

// ---------------------------------------------------------------------------
// Helper: logout (invalidate token)
// ---------------------------------------------------------------------------
function logout(token) {
  // Some APIs use POST /auth/logout, others just discard the token client-side.
  // Adjust the path if your logout endpoint differs.
  const response = http.post(
    `${BASE_URL}/api/v1/auth/logout`,
    null,
    {
      headers: { ...JSON_HEADERS, 'Authorization': `Bearer ${token}` },
      tags: { operation: 'logout' },
    },
  );

  // Accept 200 or 204 as success. Some implementations return 404 if no endpoint exists.
  check(response, {
    'logout: status is 200 or 204 or 404': (r) => [200, 204, 404].includes(r.status),
  });
}

// ---------------------------------------------------------------------------
// Default export — the VU function
// Behaviour branches based on SCENARIO_NAME env var set per-scenario.
// ---------------------------------------------------------------------------
export default function main() {
  const scenarioName = __ENV.SCENARIO_NAME || 'smoke';

  switch (scenarioName) {
    case 'smoke':
      runSmoke();
      break;
    case 'load':
      runLoad();
      break;
    case 'stress':
      runStress();
      break;
    case 'spike':
      runSpike();
      break;
    case 'auth-flow':
      runAuthFlow();
      break;
    default:
      runSmoke();
  }
}

// ---------------------------------------------------------------------------
// Smoke scenario — just hit /health repeatedly
// ---------------------------------------------------------------------------
function runSmoke() {
  group('smoke: health check', () => {
    const response = http.get(`${BASE_URL}/health`, {
      tags: { operation: 'health' },
    });

    check(response, {
      'health: status is 200': (r) => r.status === 200,
      'health: response time < 100ms': (r) => r.timings.duration < 100,
    });

    if (response.status !== 200) {
      logError('health', response);
    }
  });

  sleep(1);
}

// ---------------------------------------------------------------------------
// Load scenario — realistic browsing: health + authenticated room listing
// ---------------------------------------------------------------------------
function runLoad() {
  group('load: health', () => {
    const response = http.get(`${BASE_URL}/health`, {
      tags: { operation: 'health' },
    });
    check(response, {
      'health: status is 200': (r) => r.status === 200,
    });
  });

  sleep(Math.random() * 0.5 + 0.5); // 0.5–1s think time

  group('load: login + get rooms', () => {
    const token = login();
    if (!token) return;

    sleep(Math.random() * 0.3 + 0.2); // brief pause after login

    getRooms(token);
  });

  sleep(Math.random() * 2 + 1); // 1–3s think time between iterations
}

// ---------------------------------------------------------------------------
// Stress scenario — same as load but with shorter think times to push harder
// ---------------------------------------------------------------------------
function runStress() {
  group('stress: health', () => {
    const response = http.get(`${BASE_URL}/health`, {
      tags: { operation: 'health' },
    });
    check(response, {
      'health: status is 200': (r) => r.status === 200,
    });
  });

  sleep(0.1);

  group('stress: login + get rooms', () => {
    const token = login();
    if (!token) return;
    getRooms(token);
  });

  sleep(Math.random() * 0.5); // minimal think time to maximise pressure
}

// ---------------------------------------------------------------------------
// Spike scenario — as fast as possible with no sleep to simulate a burst
// ---------------------------------------------------------------------------
function runSpike() {
  group('spike: health', () => {
    const response = http.get(`${BASE_URL}/health`, {
      tags: { operation: 'health' },
    });
    check(response, {
      'health: status is 200 or 429 or 503': (r) => [200, 429, 503].includes(r.status),
    });
  });

  // No sleep — maximum concurrency during spike
}

// ---------------------------------------------------------------------------
// Auth flow scenario — full login → browse → logout lifecycle
// ---------------------------------------------------------------------------
function runAuthFlow() {
  group('auth-flow: full lifecycle', () => {
    // Step 1: Health check
    const healthRes = http.get(`${BASE_URL}/health`, {
      tags: { operation: 'health' },
    });
    check(healthRes, {
      'auth-flow - health: 200': (r) => r.status === 200,
    });

    sleep(0.2);

    // Step 2: Login
    const token = login();
    if (!token) {
      sleep(1);
      return;
    }

    sleep(Math.random() * 0.5 + 0.3);

    // Step 3: Fetch rooms (primary data)
    group('auth-flow: get rooms', () => {
      getRooms(token);
    });

    sleep(Math.random() * 0.5 + 0.2);

    // Step 4: Fetch additional resources as a realistic user session
    group('auth-flow: get guests', () => {
      const guestsRes = http.get(`${BASE_URL}/api/v1/guests`, {
        headers: { ...JSON_HEADERS, 'Authorization': `Bearer ${token}` },
        tags: { operation: 'get-guests' },
      });
      check(guestsRes, {
        'auth-flow - guests: 200 or 403': (r) => [200, 403].includes(r.status),
      });
      if (![200, 403].includes(guestsRes.status)) {
        apiErrors.add(1);
        logError('guests', guestsRes);
      }
    });

    sleep(Math.random() * 0.5 + 0.3);

    // Step 5: Attempt an unauthenticated request (security validation)
    group('auth-flow: unauthenticated request check', () => {
      const unauthRes = http.get(`${BASE_URL}/api/v1/rooms`, {
        headers: JSON_HEADERS,
        tags: { operation: 'unauth-rooms' },
      });
      check(unauthRes, {
        'auth-flow - unauthenticated: returns 401': (r) => r.status === 401,
      });
    });

    sleep(Math.random() * 0.3 + 0.1);

    // Step 6: Logout
    group('auth-flow: logout', () => {
      logout(token);
    });
  });

  sleep(Math.random() * 1.5 + 0.5); // 0.5–2s pause between full flows
}

// ---------------------------------------------------------------------------
// Setup — runs once before VUs start. Can be used to warm up caches.
// ---------------------------------------------------------------------------
export function setup() {
  console.log(`\n========================================`);
  console.log(`Quantum Vorvex k6 Load Test`);
  console.log(`Target: ${BASE_URL}`);
  console.log(`Active scenarios: ${Object.keys(activeScenarios).join(', ')}`);
  console.log(`========================================\n`);

  // Verify the server is up before starting
  const healthRes = http.get(`${BASE_URL}/health`);
  if (healthRes.status !== 200) {
    throw new Error(
      `Pre-flight health check failed: ${healthRes.status} — ` +
      `is the server running at ${BASE_URL}?`,
    );
  }

  console.log(`Pre-flight health check: OK (${healthRes.timings.duration.toFixed(0)}ms)`);

  return {
    startTime: new Date().toISOString(),
    baseUrl: BASE_URL,
  };
}

// ---------------------------------------------------------------------------
// Teardown — runs once after all VUs finish. Summarise results.
// ---------------------------------------------------------------------------
export function teardown(data) {
  console.log(`\n========================================`);
  console.log(`Load test completed`);
  console.log(`Started : ${data.startTime}`);
  console.log(`Finished: ${new Date().toISOString()}`);
  console.log(`Target  : ${data.baseUrl}`);
  console.log(`========================================\n`);
}

// ---------------------------------------------------------------------------
// handleSummary — custom text summary output
// ---------------------------------------------------------------------------
export function handleSummary(data) {
  const failed = data.metrics['http_req_failed'];
  const duration = data.metrics['http_req_duration'];

  const failedRate = failed ? (failed.values.rate * 100).toFixed(2) : 'N/A';
  const p95 = duration ? duration.values['p(95)'].toFixed(0) : 'N/A';
  const p99 = duration ? duration.values['p(99)'].toFixed(0) : 'N/A';
  const totalReqs = data.metrics['http_reqs'] ? data.metrics['http_reqs'].values.count : 0;

  const summary = `
========================================
  Quantum Vorvex — k6 Load Test Summary
========================================

  Total requests   : ${totalReqs}
  Error rate       : ${failedRate}% (threshold: <1%)
  p(95) duration   : ${p95}ms (threshold: <500ms)
  p(99) duration   : ${p99}ms (threshold: <2000ms)

  See full results above for per-scenario and per-metric breakdown.
========================================
`;

  return {
    stdout: summary,
    'k6-results.json': JSON.stringify(data, null, 2),
  };
}
