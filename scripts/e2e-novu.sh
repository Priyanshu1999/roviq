#!/usr/bin/env bash
# Runs Novu e2e tests against the local self-hosted Novu instance.
#
# Isolation strategy:
#   - smoke test:  creates a disposable Novu org, fully isolated, cleaned up on exit
#   - login test:  uses the dev org (notification-service routes to it), cleans up test data
#
# Requires: local Novu running + novu-setup completed
#
# Usage:
#   scripts/e2e-novu.sh              # all novu e2e tests
#   scripts/e2e-novu.sh smoke        # only smoke test (isolated test org)
#   scripts/e2e-novu.sh login        # only login notification test (dev org, cleaned up)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HURL_DIR="$REPO_ROOT/e2e/api-gateway-e2e/hurl/novu"
VARS_FILE="$HURL_DIR/vars.env"
NOVU_API="http://localhost:3340"
TEMP_VARS=""
TEST_ORG_ID=""

# Load .env
set -a
# shellcheck disable=SC1091
source "$REPO_ROOT/.env"
set +a

if [ -z "${NOVU_SECRET_KEY:-}" ]; then
  echo "ERROR: NOVU_SECRET_KEY not set in .env. Run scripts/novu-setup.sh first."
  exit 1
fi

# ─── Cleanup ──────────────────────────────────────────────────────────────────

cleanup() {
  rm -f "$TEMP_VARS" 2>/dev/null

  # Clean up isolated test org (smoke test)
  if [ -n "$TEST_ORG_ID" ]; then
    echo "==> Cleaning up test org..."
    docker exec docker-mongodb-1 mongosh --quiet --eval "
      db = db.getSiblingDB('novu');
      var orgId = ObjectId('$TEST_ORG_ID');
      ['environments','members','notificationtemplates','notificationgroups',
       'integrations','subscribers','notifications','messages','jobs',
       'layouts','feeds','changes','controls'].forEach(function(c) {
        db[c].deleteMany({ _organizationId: orgId });
      });
      db.organizations.deleteOne({ _id: orgId });
      print('done');
    " > /dev/null 2>&1 && echo "  ✓ Test org cleaned up" || echo "  ⚠ Cleanup failed (non-critical)"
  fi

  # Clean up test user from the e2e user table
  if [ -n "${TEST_USER_ID:-}" ]; then
    docker exec docker-mongodb-1 mongosh --quiet --eval "
      db = db.getSiblingDB('novu');
      db.users.deleteMany({ email: /e2e-.*@roviq\.test/ });
    " > /dev/null 2>&1
  fi
}
trap cleanup EXIT

# ─── Pre-flight ───────────────────────────────────────────────────────────────

echo "==> Pre-flight checks..."

if ! command -v hurl &>/dev/null; then
  echo "ERROR: hurl is not installed. Install it: https://hurl.dev/docs/installation.html"
  exit 1
fi

if ! curl -sf "$NOVU_API/v1/health-check" >/dev/null 2>&1; then
  echo "ERROR: Local Novu API not reachable at $NOVU_API"
  exit 1
fi
echo "  ✓ Novu API reachable"

# ─── Select test files ────────────────────────────────────────────────────────

NEED_GATEWAY=false
RUN_SMOKE=false
RUN_LOGIN=false

case "${1:-all}" in
  smoke)  RUN_SMOKE=true ;;
  login)  RUN_LOGIN=true; NEED_GATEWAY=true ;;
  all)    RUN_SMOKE=true; RUN_LOGIN=true; NEED_GATEWAY=true ;;
  *)      echo "Usage: $0 [smoke|login|all]"; exit 1 ;;
esac

if [ "$NEED_GATEWAY" = true ]; then
  if ! curl -sf http://localhost:3000/api/health >/dev/null 2>&1; then
    echo "ERROR: API Gateway not reachable at http://localhost:3000"; exit 1
  fi
  echo "  ✓ API Gateway reachable"
  if ! curl -sf http://localhost:3002/api/novu >/dev/null 2>&1; then
    echo "ERROR: Notification service not reachable at http://localhost:3002"; exit 1
  fi
  echo "  ✓ Notification service reachable"
fi

FAILED=0

# ─── Smoke test (isolated test org) ──────────────────────────────────────────

if [ "$RUN_SMOKE" = true ]; then
  echo ""
  echo "==> [smoke] Creating isolated test org..."
  TIMESTAMP=$(date +%s)
  TEST_EMAIL="e2e-${TIMESTAMP}@roviq.test"

  REGISTER_RESULT=$(curl -s -X POST "$NOVU_API/v1/auth/register" \
    -H "Content-Type: application/json" \
    -d "{
      \"firstName\": \"E2E\", \"lastName\": \"Test\",
      \"email\": \"$TEST_EMAIL\", \"password\": \"E2eTest123!@#\",
      \"organizationName\": \"E2E Smoke ${TIMESTAMP}\"
    }")

  if ! echo "$REGISTER_RESULT" | grep -q '"token"'; then
    echo "ERROR: Failed to create test org: $REGISTER_RESULT"
    exit 1
  fi

  TEST_JWT=$(curl -s -X POST "$NOVU_API/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"$TEST_EMAIL\", \"password\": \"E2eTest123!@#\"}" \
    | python3 -c "import json,sys; print(json.load(sys.stdin)['data']['token'])")

  SMOKE_API_KEY=$(curl -s "$NOVU_API/v1/environments" -H "Authorization: Bearer $TEST_JWT" \
    | python3 -c "import json,sys; print(json.load(sys.stdin)['data'][0]['apiKeys'][0]['key'])")

  TEST_ORG_ID=$(docker exec docker-mongodb-1 mongosh --quiet --eval "
    db = db.getSiblingDB('novu');
    var org = db.organizations.findOne({ name: 'E2E Smoke ${TIMESTAMP}' });
    if (org) print(String(org._id));
  " 2>/dev/null | tr -d '[:space:]')

  # Validate org ID is a 24-char hex string to prevent injection
  if [[ ! "$TEST_ORG_ID" =~ ^[0-9a-f]{24}$ ]]; then
    echo "  ⚠ Could not determine test org ID — cleanup will be skipped"
    TEST_ORG_ID=""
  fi

  echo "  ✓ Test org created"

  TEMP_VARS=$(mktemp)
  cp "$VARS_FILE" "$TEMP_VARS"
  echo "novu_api_key=$SMOKE_API_KEY" >> "$TEMP_VARS"
  echo "username=admin" >> "$TEMP_VARS"
  echo "password=admin123" >> "$TEMP_VARS"

  echo "==> [smoke] Running..."
  # shellcheck disable=SC2086
  hurl --test --jobs 1 --variables-file "$TEMP_VARS" \
    "$HURL_DIR/01-novu-api-smoke.hurl" || FAILED=1

  rm -f "$TEMP_VARS"
  TEMP_VARS=""
fi

# ─── Login test (dev org, with cleanup) ───────────────────────────────────────

if [ "$RUN_LOGIN" = true ]; then
  echo ""
  echo "==> [login] Using dev org (notification-service routes here)..."

  TEMP_VARS=$(mktemp)
  cp "$VARS_FILE" "$TEMP_VARS"
  echo "novu_api_key=$NOVU_SECRET_KEY" >> "$TEMP_VARS"
  echo "username=admin" >> "$TEMP_VARS"
  echo "password=admin123" >> "$TEMP_VARS"

  echo "==> [login] Running..."
  # shellcheck disable=SC2086
  hurl --test --jobs 1 --variables-file "$TEMP_VARS" \
    "$HURL_DIR/02-login-notification.hurl" || FAILED=1

  rm -f "$TEMP_VARS"
  TEMP_VARS=""
fi

# ─── Result ───────────────────────────────────────────────────────────────────

echo ""
if [ "$FAILED" -ne 0 ]; then
  echo "Some tests failed."
  exit 1
else
  echo "All tests passed."
fi
