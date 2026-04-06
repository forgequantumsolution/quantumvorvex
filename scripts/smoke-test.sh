#!/usr/bin/env bash
# =============================================================================
# Quantum Vorvex — API Smoke Tests
# =============================================================================
# Usage:
#   bash scripts/smoke-test.sh
#   BASE_URL=https://api.example.com bash scripts/smoke-test.sh
#   TEST_EMAIL=admin@example.com TEST_PASSWORD=secret bash scripts/smoke-test.sh
#
# Environment variables:
#   BASE_URL       — API base URL (default: http://localhost:5000)
#   TEST_EMAIL     — Valid user email for authenticated tests
#   TEST_PASSWORD  — Valid user password for authenticated tests
#
# Exit code 0 if all tests pass; 1 if any test fails.
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
BASE_URL="${BASE_URL:-http://localhost:5000}"
TEST_EMAIL="${TEST_EMAIL:-admin@quantumvorvex.com}"
TEST_PASSWORD="${TEST_PASSWORD:-changeme}"

# ---------------------------------------------------------------------------
# Colours
# ---------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
RESET='\033[0m'

# ---------------------------------------------------------------------------
# State
# ---------------------------------------------------------------------------
FAILURES=0
TESTS_RUN=0
declare -a RESULTS=()
AUTH_TOKEN=""

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

# record_result <test_name> <pass|fail> <detail>
record_result() {
  local name="$1"
  local status="$2"
  local detail="$3"
  TESTS_RUN=$((TESTS_RUN + 1))

  if [ "${status}" = "pass" ]; then
    RESULTS+=("  [ ${GREEN}PASS${RESET} ]  ${name}  ${BLUE}${detail}${RESET}")
  else
    RESULTS+=("  [ ${RED}FAIL${RESET} ]  ${name}  ${RED}${detail}${RESET}")
    FAILURES=$((FAILURES + 1))
  fi
}

# http_request <method> <path> [<body>] [<token>]
# Outputs: "<http_status>|<response_time_ms>|<body>"
http_request() {
  local method="${1}"
  local path="${2}"
  local body="${3:-}"
  local token="${4:-}"

  local curl_args=(
    --silent
    --show-error
    --write-out "\n%{http_code}|%{time_total}"
    --request "${method}"
    --url "${BASE_URL}${path}"
    --header "Content-Type: application/json"
    --header "Accept: application/json"
    --connect-timeout 10
    --max-time 30
  )

  if [ -n "${token}" ]; then
    curl_args+=(--header "Authorization: Bearer ${token}")
  fi

  if [ -n "${body}" ]; then
    curl_args+=(--data "${body}")
  fi

  # Capture output: last line is "statuscode|time_total"
  local output
  output=$(curl "${curl_args[@]}" 2>&1) || {
    echo "000|0|connection_failed"
    return
  }

  local last_line
  last_line=$(echo "${output}" | tail -n 1)
  local response_body
  response_body=$(echo "${output}" | head -n -1)

  local http_code time_total
  http_code=$(echo "${last_line}" | cut -d'|' -f1)
  time_total=$(echo "${last_line}" | cut -d'|' -f2)

  # Convert time to milliseconds (awk for portability)
  local time_ms
  time_ms=$(echo "${time_total}" | awk '{printf "%d", $1 * 1000}')

  echo "${http_code}|${time_ms}|${response_body}"
}

# assert_status <test_name> <actual_status> <expected_status> <time_ms>
assert_status() {
  local name="$1"
  local actual="$2"
  local expected="$3"
  local time_ms="$4"

  local detail="HTTP ${actual} (expected ${expected}) — ${time_ms}ms"

  if [ "${actual}" = "${expected}" ]; then
    record_result "${name}" "pass" "${detail}"
    return 0
  else
    record_result "${name}" "fail" "${detail}"
    return 1
  fi
}

# ---------------------------------------------------------------------------
# Banner
# ---------------------------------------------------------------------------
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║         Quantum Vorvex — API Smoke Tests                 ║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════════╝${RESET}"
echo ""
echo -e "  Target  : ${BASE_URL}"
echo -e "  Date    : $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo -e "  User    : ${TEST_EMAIL}"
echo ""
echo -e "${BOLD}──────────────────────────────────────────────────────────${RESET}"

# ---------------------------------------------------------------------------
# Pre-check: is the server reachable at all?
# ---------------------------------------------------------------------------
echo ""
echo -e "${BOLD}Pre-check — Server Reachability${RESET}"
echo ""

if ! curl --silent --connect-timeout 5 --max-time 10 --output /dev/null "${BASE_URL}/health" 2>/dev/null; then
  echo -e "  ${RED}${BOLD}FATAL: Cannot reach ${BASE_URL}${RESET}"
  echo -e "  ${YELLOW}Ensure the server is running before executing smoke tests.${RESET}"
  echo -e "  ${YELLOW}Start with: cd server && npm run dev${RESET}"
  echo ""
  exit 1
fi

echo -e "  ${GREEN}Server is reachable at ${BASE_URL}${RESET}"

# =============================================================================
# Test 1: GET /health — should return 200
# =============================================================================
echo ""
echo -e "${BOLD}Test 1 — Health Check${RESET}"

RESPONSE=$(http_request "GET" "/health")
STATUS=$(echo "${RESPONSE}" | cut -d'|' -f1)
TIME_MS=$(echo "${RESPONSE}" | cut -d'|' -f2)
BODY=$(echo "${RESPONSE}" | cut -d'|' -f3-)

assert_status "GET /health returns 200" "${STATUS}" "200" "${TIME_MS}" || true

echo -e "  Response: ${BODY}" | head -c 200
echo ""

# =============================================================================
# Test 2: POST /api/v1/auth/login — bad credentials should return 401
# =============================================================================
echo ""
echo -e "${BOLD}Test 2 — Login with Bad Credentials (expect 401)${RESET}"

BAD_CREDS='{"email":"notauser@example.com","password":"wrongpassword123"}'
RESPONSE=$(http_request "POST" "/api/v1/auth/login" "${BAD_CREDS}")
STATUS=$(echo "${RESPONSE}" | cut -d'|' -f1)
TIME_MS=$(echo "${RESPONSE}" | cut -d'|' -f2)

assert_status "POST /api/v1/auth/login (bad creds) returns 401" "${STATUS}" "401" "${TIME_MS}" || true

# =============================================================================
# Test 3: GET /api/v1/rooms — unauthenticated should return 401
# =============================================================================
echo ""
echo -e "${BOLD}Test 3 — Access Protected Route Without Auth (expect 401)${RESET}"

RESPONSE=$(http_request "GET" "/api/v1/rooms")
STATUS=$(echo "${RESPONSE}" | cut -d'|' -f1)
TIME_MS=$(echo "${RESPONSE}" | cut -d'|' -f2)

assert_status "GET /api/v1/rooms (no auth) returns 401" "${STATUS}" "401" "${TIME_MS}" || true

# =============================================================================
# Test 4: POST /api/v1/auth/login — valid credentials should return 200 + token
# =============================================================================
echo ""
echo -e "${BOLD}Test 4 — Login with Valid Credentials (expect 200 + token)${RESET}"

GOOD_CREDS="{\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASSWORD}\"}"
RESPONSE=$(http_request "POST" "/api/v1/auth/login" "${GOOD_CREDS}")
STATUS=$(echo "${RESPONSE}" | cut -d'|' -f1)
TIME_MS=$(echo "${RESPONSE}" | cut -d'|' -f2)
BODY=$(echo "${RESPONSE}" | cut -d'|' -f3-)

assert_status "POST /api/v1/auth/login (valid creds) returns 200" "${STATUS}" "200" "${TIME_MS}" || true

# Extract token — try common response shapes
if command -v jq &>/dev/null; then
  AUTH_TOKEN=$(echo "${BODY}" | jq -r '.token // .accessToken // .data.token // .data.accessToken // empty' 2>/dev/null || true)
else
  # Fallback: grep for a JWT-shaped string
  AUTH_TOKEN=$(echo "${BODY}" | grep -oP '"(?:token|accessToken)"\s*:\s*"\K[^"]+' | head -1 || true)
fi

if [ -n "${AUTH_TOKEN}" ]; then
  echo -e "  ${GREEN}Token obtained successfully (${#AUTH_TOKEN} chars)${RESET}"
  record_result "Login response contains JWT token" "pass" "Token length: ${#AUTH_TOKEN}"
else
  echo -e "  ${YELLOW}Warning: Could not extract token from response body${RESET}"
  echo -e "  Body: ${BODY}" | head -c 300
  echo ""
  record_result "Login response contains JWT token" "fail" "Token not found in response body — check TEST_EMAIL and TEST_PASSWORD"
fi

# =============================================================================
# Test 5: GET /api/v1/rooms — authenticated should return 200
# =============================================================================
echo ""
echo -e "${BOLD}Test 5 — Access Protected Route With Auth (expect 200)${RESET}"

if [ -z "${AUTH_TOKEN}" ]; then
  record_result "GET /api/v1/rooms (with auth) returns 200" "fail" "SKIPPED — no auth token available from Test 4"
else
  RESPONSE=$(http_request "GET" "/api/v1/rooms" "" "${AUTH_TOKEN}")
  STATUS=$(echo "${RESPONSE}" | cut -d'|' -f1)
  TIME_MS=$(echo "${RESPONSE}" | cut -d'|' -f2)
  BODY=$(echo "${RESPONSE}" | cut -d'|' -f3-)

  assert_status "GET /api/v1/rooms (with auth) returns 200" "${STATUS}" "200" "${TIME_MS}" || true

  if command -v jq &>/dev/null; then
    ROOM_COUNT=$(echo "${BODY}" | jq '. | if type=="array" then length elif .data and (.data | type=="array") then .data | length else "?" end' 2>/dev/null || echo "?")
    echo -e "  Rooms returned: ${ROOM_COUNT}"
  fi
fi

# =============================================================================
# Test 6: GET /api/v1/guests — authenticated should return 200 (bonus check)
# =============================================================================
echo ""
echo -e "${BOLD}Test 6 — Access Guest List With Auth (expect 200)${RESET}"

if [ -z "${AUTH_TOKEN}" ]; then
  record_result "GET /api/v1/guests (with auth) returns 200" "fail" "SKIPPED — no auth token available"
else
  RESPONSE=$(http_request "GET" "/api/v1/guests" "" "${AUTH_TOKEN}")
  STATUS=$(echo "${RESPONSE}" | cut -d'|' -f1)
  TIME_MS=$(echo "${RESPONSE}" | cut -d'|' -f2)

  assert_status "GET /api/v1/guests (with auth) returns 200" "${STATUS}" "200" "${TIME_MS}" || true
fi

# =============================================================================
# Summary
# =============================================================================
echo ""
echo -e "${BOLD}══════════════════════════════════════════════════════════${RESET}"
echo -e "${BOLD}  SMOKE TEST SUMMARY — Quantum Vorvex                     ${RESET}"
echo -e "${BOLD}══════════════════════════════════════════════════════════${RESET}"
echo ""

for result in "${RESULTS[@]}"; do
  echo -e "${result}"
done

echo ""
echo -e "${BOLD}──────────────────────────────────────────────────────────${RESET}"
echo -e "  Total tests : ${TESTS_RUN}"
echo -e "  Passed      : ${GREEN}$((TESTS_RUN - FAILURES))${RESET}"
echo -e "  Failed      : ${FAILURES}"

if [ "${FAILURES}" -gt 0 ]; then
  echo ""
  echo -e "  ${RED}${BOLD}Result: FAILED — ${FAILURES} test(s) did not pass${RESET}"
  echo ""
  exit 1
else
  echo ""
  echo -e "  ${GREEN}${BOLD}Result: ALL TESTS PASSED${RESET}"
  echo ""
  exit 0
fi
