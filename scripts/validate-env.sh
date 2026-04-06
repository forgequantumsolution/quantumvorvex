#!/bin/bash
# ──────────────────────────────────────────────────────────────────────────────
# validate-env.sh — Verify all required environment variables are set
# Run before starting the server: bash scripts/validate-env.sh
# ──────────────────────────────────────────────────────────────────────────────

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

FAILED=0

check_var() {
  local name="$1"
  local description="$2"
  local required="${3:-true}"

  if [ -z "${!name:-}" ]; then
    if [ "$required" = "true" ]; then
      echo -e "${RED}✗ MISSING${NC}  $name — $description"
      FAILED=$((FAILED + 1))
    else
      echo -e "${YELLOW}○ OPTIONAL${NC} $name — $description (not set)"
    fi
  else
    # Mask value for display
    local val="${!name}"
    local masked="${val:0:4}****"
    echo -e "${GREEN}✓ OK${NC}       $name = $masked"
  fi
}

check_min_length() {
  local name="$1"
  local min_len="$2"
  local description="$3"

  if [ -z "${!name:-}" ]; then
    echo -e "${RED}✗ MISSING${NC}  $name — $description"
    FAILED=$((FAILED + 1))
    return
  fi

  local len=${#!name}
  # Bash indirect expansion for length
  local val="${!name}"
  local actual_len=${#val}

  if [ "$actual_len" -lt "$min_len" ]; then
    echo -e "${RED}✗ TOO SHORT${NC} $name — must be at least $min_len characters (got $actual_len)"
    FAILED=$((FAILED + 1))
  else
    local masked="${val:0:4}****"
    echo -e "${GREEN}✓ OK${NC}       $name = $masked (${actual_len} chars)"
  fi
}

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Quantum Vorvex — Environment Variable Validation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "[ Required ]"
check_var      "DATABASE_URL"   "Prisma database connection string"
check_min_length "JWT_SECRET"   32 "JWT signing secret (min 32 chars)"
check_var      "PORT"           "HTTP server port"
check_var      "NODE_ENV"       "Runtime environment (development|staging|production)"
check_var      "CLIENT_URL"     "Allowed CORS origin(s)"

echo ""
echo "[ Optional ]"
check_var "MESSAGING_PROVIDER"  "Messaging backend (mock|twilio|msg91)" false
check_var "TWILIO_ACCOUNT_SID"  "Twilio account SID"                    false
check_var "TWILIO_AUTH_TOKEN"   "Twilio auth token"                     false
check_var "MSG91_API_KEY"       "Msg91 API key"                         false
check_var "ANTHROPIC_API_KEY"   "Anthropic API key (AI assistant)"      false
check_var "LOG_LEVEL"           "Log level (error|warn|info|debug)"     false
check_var "MAX_FILE_SIZE_MB"    "Max file upload size in MB"            false

# Extra validation: warn if JWT_SECRET looks like the example value
if [ "${JWT_SECRET:-}" = "CHANGE_ME_generate_a_32_char_random_secret" ]; then
  echo ""
  echo -e "${RED}✗ SECURITY${NC}  JWT_SECRET is using the example value — generate a real secret!"
  FAILED=$((FAILED + 1))
fi

# Warn if NODE_ENV=production but DATABASE_URL points to SQLite
if [ "${NODE_ENV:-}" = "production" ] && [[ "${DATABASE_URL:-}" == file:* ]]; then
  echo ""
  echo -e "${YELLOW}⚠ WARNING${NC}   NODE_ENV=production but DATABASE_URL uses SQLite — use PostgreSQL in production"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}  ✓ All required environment variables are set${NC}"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  exit 0
else
  echo -e "${RED}  ✗ $FAILED required variable(s) missing or invalid${NC}"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "  Copy server/.env.example → server/.env and fill in values."
  echo ""
  exit 1
fi
