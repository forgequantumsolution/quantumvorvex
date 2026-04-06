#!/usr/bin/env bash
# =============================================================================
# Quantum Vorvex — Local DevSecOps Security Audit
# =============================================================================
# Usage:  bash scripts/security-audit.sh
# Runs a series of local security checks and prints a summary report.
# Exit code 1 if any check fails; 0 if all pass.
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Colours and formatting
# ---------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
RESET='\033[0m'

PASS="${GREEN}PASS${RESET}"
FAIL="${RED}FAIL${RESET}"
WARN="${YELLOW}WARN${RESET}"
SKIP="${BLUE}SKIP${RESET}"

# ---------------------------------------------------------------------------
# State tracking
# ---------------------------------------------------------------------------
FAILURES=0
WARNINGS=0
declare -a RESULTS=()

pass()  { RESULTS+=("  [ ${GREEN}PASS${RESET} ]  $1"); }
fail()  { RESULTS+=("  [ ${RED}FAIL${RESET} ]  $1"); ((FAILURES++)) || true; }
warn()  { RESULTS+=("  [ ${YELLOW}WARN${RESET} ]  $1"); ((WARNINGS++)) || true; }
skip()  { RESULTS+=("  [ ${BLUE}SKIP${RESET} ]  $1"); }

# ---------------------------------------------------------------------------
# Resolve project root (the directory containing this script's parent)
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
SERVER_DIR="${PROJECT_ROOT}/server"
CLIENT_DIR="${PROJECT_ROOT}/client"

# ---------------------------------------------------------------------------
# Banner
# ---------------------------------------------------------------------------
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║     Quantum Vorvex — Local DevSecOps Security Audit      ║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════════╝${RESET}"
echo ""
echo -e "  Project root : ${PROJECT_ROOT}"
echo -e "  Date         : $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo -e "  Git branch   : $(git -C "${PROJECT_ROOT}" rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'not a git repo')"
echo -e "  Git commit   : $(git -C "${PROJECT_ROOT}" rev-parse --short HEAD 2>/dev/null || echo 'n/a')"
echo ""
echo -e "${BOLD}──────────────────────────────────────────────────────────${RESET}"

# =============================================================================
# Step 1: Gitleaks — secret detection
# =============================================================================
echo ""
echo -e "${BOLD}Step 1 — Secret Detection (gitleaks)${RESET}"
echo ""

if ! command -v gitleaks &>/dev/null; then
  fail "gitleaks not installed. Install with: brew install gitleaks OR scoop install gitleaks"
  echo -e "  ${YELLOW}Skipping gitleaks scan.${RESET}"
else
  echo -e "  gitleaks version: $(gitleaks version 2>/dev/null || echo 'unknown')"
  echo -e "  Scanning ${PROJECT_ROOT} for secrets..."

  GITLEAKS_REPORT="/tmp/gitleaks-report-$(date +%Y%m%d-%H%M%S).json"

  if gitleaks detect \
      --source "${PROJECT_ROOT}" \
      --report-path "${GITLEAKS_REPORT}" \
      --report-format json \
      --no-banner \
      --exit-code 1 \
      2>/dev/null; then
    pass "gitleaks: No secrets detected"
    rm -f "${GITLEAKS_REPORT}"
  else
    fail "gitleaks: Potential secrets found! Review report: ${GITLEAKS_REPORT}"
    echo -e "  ${RED}Run: gitleaks detect --source . to see findings${RESET}"
  fi
fi

# =============================================================================
# Step 2: npm audit — dependency vulnerability check
# =============================================================================
echo ""
echo -e "${BOLD}Step 2 — Dependency Vulnerability Check (npm audit)${RESET}"
echo ""

# Server
if [ -f "${SERVER_DIR}/package.json" ]; then
  echo -e "  Auditing server dependencies..."
  cd "${SERVER_DIR}"
  AUDIT_OUTPUT=$(npm audit --audit-level=moderate 2>&1) || AUDIT_EXIT=$?
  AUDIT_EXIT=${AUDIT_EXIT:-0}

  CRITICAL_COUNT=$(echo "${AUDIT_OUTPUT}" | grep -oP '\d+(?= critical)' | head -1 || echo "0")
  HIGH_COUNT=$(echo "${AUDIT_OUTPUT}" | grep -oP '\d+(?= high)' | head -1 || echo "0")

  if [ "${AUDIT_EXIT}" -eq 0 ]; then
    pass "npm audit (server): No moderate+ vulnerabilities found"
  elif [ "${CRITICAL_COUNT:-0}" -gt 0 ] || [ "${HIGH_COUNT:-0}" -gt 0 ]; then
    fail "npm audit (server): Critical/High vulnerabilities found. Run 'npm audit' in server/ for details."
  else
    warn "npm audit (server): Moderate vulnerabilities found. Run 'npm audit' in server/ for details."
  fi
  cd "${PROJECT_ROOT}"
else
  skip "npm audit (server): No package.json found at ${SERVER_DIR}"
fi

# Client
if [ -f "${CLIENT_DIR}/package.json" ]; then
  echo -e "  Auditing client dependencies..."
  cd "${CLIENT_DIR}"
  AUDIT_OUTPUT=$(npm audit --audit-level=moderate 2>&1) || AUDIT_EXIT=$?
  AUDIT_EXIT=${AUDIT_EXIT:-0}

  CRITICAL_COUNT=$(echo "${AUDIT_OUTPUT}" | grep -oP '\d+(?= critical)' | head -1 || echo "0")
  HIGH_COUNT=$(echo "${AUDIT_OUTPUT}" | grep -oP '\d+(?= high)' | head -1 || echo "0")

  if [ "${AUDIT_EXIT}" -eq 0 ]; then
    pass "npm audit (client): No moderate+ vulnerabilities found"
  elif [ "${CRITICAL_COUNT:-0}" -gt 0 ] || [ "${HIGH_COUNT:-0}" -gt 0 ]; then
    fail "npm audit (client): Critical/High vulnerabilities found. Run 'npm audit' in client/ for details."
  else
    warn "npm audit (client): Moderate vulnerabilities found. Run 'npm audit' in client/ for details."
  fi
  cd "${PROJECT_ROOT}"
else
  skip "npm audit (client): No package.json found at ${CLIENT_DIR}"
fi

# =============================================================================
# Step 3: ESLint with security plugin
# =============================================================================
echo ""
echo -e "${BOLD}Step 3 — Static Analysis (ESLint + security plugin)${RESET}"
echo ""

ESLINT_BIN="${PROJECT_ROOT}/node_modules/.bin/eslint"
SERVER_ESLINT_BIN="${SERVER_DIR}/node_modules/.bin/eslint"

# Try server-local eslint first, then project root
if [ -f "${SERVER_ESLINT_BIN}" ]; then
  ESLINT_CMD="${SERVER_ESLINT_BIN}"
  ESLINT_ROOT="${SERVER_DIR}"
elif [ -f "${ESLINT_BIN}" ]; then
  ESLINT_CMD="${ESLINT_BIN}"
  ESLINT_ROOT="${PROJECT_ROOT}"
else
  ESLINT_CMD=""
fi

if [ -z "${ESLINT_CMD}" ]; then
  skip "ESLint: not found in node_modules. Run 'npm install' in server/ or project root to enable."
else
  echo -e "  Running ESLint on server/src..."
  if [ -d "${SERVER_DIR}/src" ]; then
    cd "${ESLINT_ROOT}"
    ESLINT_OUT=$(${ESLINT_CMD} "${SERVER_DIR}/src" --ext .js,.mjs --max-warnings 0 2>&1) || ESLINT_EXIT=$?
    ESLINT_EXIT=${ESLINT_EXIT:-0}

    if [ "${ESLINT_EXIT}" -eq 0 ]; then
      pass "ESLint: No errors or warnings in server/src"
    else
      # Check if security plugin is configured
      if echo "${ESLINT_OUT}" | grep -qi "plugin.*security\|security.*plugin"; then
        fail "ESLint: Errors found (including security plugin findings). Fix before committing."
      else
        warn "ESLint: Errors/warnings found. eslint-plugin-security may not be configured."
        echo -e "  ${YELLOW}Add eslint-plugin-security to your ESLint config for security-specific rules.${RESET}"
      fi
      echo "${ESLINT_OUT}" | head -20
    fi
    cd "${PROJECT_ROOT}"
  else
    skip "ESLint: server/src directory not found"
  fi
fi

# =============================================================================
# Step 4: Check for .env files committed to Git
# =============================================================================
echo ""
echo -e "${BOLD}Step 4 — Committed .env File Check${RESET}"
echo ""

if ! git -C "${PROJECT_ROOT}" rev-parse --git-dir &>/dev/null; then
  skip ".env check: Not a git repository"
else
  echo -e "  Checking git index for .env files..."
  ENV_FILES_TRACKED=$(git -C "${PROJECT_ROOT}" ls-files '*.env' '.env' '.env.*' 2>/dev/null | grep -v '\.env\.example$' || true)

  if [ -z "${ENV_FILES_TRACKED}" ]; then
    pass ".env check: No .env files tracked in git"
  else
    fail ".env check: The following .env files are tracked by git and may expose secrets:"
    while IFS= read -r file; do
      echo -e "    ${RED}→ ${file}${RESET}"
    done <<< "${ENV_FILES_TRACKED}"
    echo -e "  ${YELLOW}Run: git rm --cached <file> && echo '<file>' >> .gitignore${RESET}"
  fi
fi

# =============================================================================
# Step 5: Grep for hardcoded secrets patterns
# =============================================================================
echo ""
echo -e "${BOLD}Step 5 — Hardcoded Secrets Pattern Scan (grep)${RESET}"
echo ""

PATTERNS=(
  "password\s*=\s*['\"][^'\"]{6,}['\"]"
  "secret\s*=\s*['\"][^'\"]{6,}['\"]"
  "api_key\s*=\s*['\"][^'\"]{6,}['\"]"
  "apikey\s*=\s*['\"][^'\"]{6,}['\"]"
  "private_key\s*=\s*['\"][^'\"]{6,}['\"]"
  "access_token\s*=\s*['\"][^'\"]{6,}['\"]"
  "BEGIN RSA PRIVATE KEY"
  "BEGIN OPENSSH PRIVATE KEY"
  "BEGIN PGP PRIVATE KEY"
)

EXCLUDE_DIRS=".git node_modules dist build coverage .cache"
EXCLUDE_ARGS=""
for d in ${EXCLUDE_DIRS}; do
  EXCLUDE_ARGS="${EXCLUDE_ARGS} --exclude-dir=${d}"
done
EXCLUDE_ARGS="${EXCLUDE_ARGS} --exclude=*.min.js --exclude=*.map --exclude=package-lock.json"

SECRETS_FOUND=0
for PATTERN in "${PATTERNS[@]}"; do
  MATCHES=$(grep -rIil ${EXCLUDE_ARGS} -E "${PATTERN}" "${PROJECT_ROOT}" 2>/dev/null || true)
  if [ -n "${MATCHES}" ]; then
    if [ "${SECRETS_FOUND}" -eq 0 ]; then
      fail "Hardcoded secrets scan: Potential secrets found matching patterns:"
    fi
    SECRETS_FOUND=1
    while IFS= read -r match_file; do
      echo -e "    ${RED}→ Pattern '${PATTERN}' matched in: ${match_file}${RESET}"
    done <<< "${MATCHES}"
  fi
done

if [ "${SECRETS_FOUND}" -eq 0 ]; then
  pass "Hardcoded secrets scan: No obvious hardcoded secrets found"
fi

# =============================================================================
# Step 6: Check node_modules not committed
# =============================================================================
echo ""
echo -e "${BOLD}Step 6 — node_modules Committed Check${RESET}"
echo ""

if ! git -C "${PROJECT_ROOT}" rev-parse --git-dir &>/dev/null; then
  skip "node_modules check: Not a git repository"
else
  NM_TRACKED=$(git -C "${PROJECT_ROOT}" ls-files '*/node_modules/*' 'node_modules/' 2>/dev/null | head -1 || true)

  if [ -z "${NM_TRACKED}" ]; then
    pass "node_modules check: node_modules not tracked in git"
  else
    fail "node_modules check: node_modules files are tracked by git. This inflates repo size and may introduce security issues."
    echo -e "  ${YELLOW}Run: git rm -r --cached node_modules/ && echo 'node_modules/' >> .gitignore${RESET}"
  fi

  # Also check .gitignore contains node_modules
  if [ -f "${PROJECT_ROOT}/.gitignore" ]; then
    if grep -q "^node_modules" "${PROJECT_ROOT}/.gitignore" 2>/dev/null; then
      pass ".gitignore check: node_modules is listed in .gitignore"
    else
      warn ".gitignore check: node_modules is not in .gitignore root"
    fi
  else
    warn ".gitignore check: No .gitignore file found in project root"
  fi
fi

# =============================================================================
# Summary Report
# =============================================================================
echo ""
echo -e "${BOLD}══════════════════════════════════════════════════════════${RESET}"
echo -e "${BOLD}  AUDIT SUMMARY — Quantum Vorvex                          ${RESET}"
echo -e "${BOLD}══════════════════════════════════════════════════════════${RESET}"
echo ""

for result in "${RESULTS[@]}"; do
  echo -e "${result}"
done

echo ""
echo -e "${BOLD}──────────────────────────────────────────────────────────${RESET}"

TOTAL=${#RESULTS[@]}

if [ "${FAILURES}" -gt 0 ]; then
  echo -e "  Result  : ${RED}${BOLD}FAILED${RESET}"
  echo -e "  Total   : ${TOTAL} checks"
  echo -e "  Failures: ${RED}${FAILURES}${RESET}"
  echo -e "  Warnings: ${YELLOW}${WARNINGS}${RESET}"
  echo ""
  echo -e "  ${RED}Fix all failures before committing or deploying.${RESET}"
  echo ""
  exit 1
elif [ "${WARNINGS}" -gt 0 ]; then
  echo -e "  Result  : ${YELLOW}${BOLD}PASSED WITH WARNINGS${RESET}"
  echo -e "  Total   : ${TOTAL} checks"
  echo -e "  Failures: ${GREEN}0${RESET}"
  echo -e "  Warnings: ${YELLOW}${WARNINGS}${RESET}"
  echo ""
  echo -e "  ${YELLOW}Review warnings before deploying to production.${RESET}"
  echo ""
  exit 0
else
  echo -e "  Result  : ${GREEN}${BOLD}ALL CHECKS PASSED${RESET}"
  echo -e "  Total   : ${TOTAL} checks"
  echo -e "  Failures: ${GREEN}0${RESET}"
  echo -e "  Warnings: ${GREEN}0${RESET}"
  echo ""
  exit 0
fi
