#!/usr/bin/env bash
# Runs billing Hurl e2e tests against an isolated test database.
# Spins up its own gateway on port 3100 so the dev gateway on :3000 stays untouched.
# Usage:
#   scripts/e2e-hurl.sh              # free-plan tests
#   scripts/e2e-hurl.sh --paid       # paid-plan tests (requires gateway sandbox creds)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TEST_PORT=3100

# Load .env
set -a
# shellcheck disable=SC1091
source "$REPO_ROOT/.env"
set +a

# Override DB URLs to point at the test database
export DATABASE_URL="$DATABASE_URL_TEST"
export DATABASE_URL_MIGRATE="$DATABASE_URL_TEST_MIGRATE"
# Use a separate port so the dev gateway on :3000 stays untouched
export API_GATEWAY_PORT="$TEST_PORT"
export ALLOWED_ORIGINS="http://localhost:$TEST_PORT"

# --- 1. Reset + seed the test database ---
echo "==> Resetting test database (roviq_test)..."
pnpx tsx "$REPO_ROOT/scripts/db-reset.ts" --seed

# --- 2. Build & start gateway ---
echo "==> Building api-gateway..."
npx nx build api-gateway --skip-nx-cache 2>&1 | tail -3

# Link dist libs so node can resolve @roviq/* at runtime
echo "==> Linking dist libs..."
mkdir -p "$REPO_ROOT/node_modules/@roviq"
for pkg in "$REPO_ROOT"/dist/libs/*/package.json; do
  dir=$(dirname "$pkg")
  name=$(node -p "require('$pkg').name.replace('@roviq/','')")
  ln -sfn "$dir" "$REPO_ROOT/node_modules/@roviq/$name"
done

echo "==> Starting api-gateway on port $TEST_PORT..."
ROVIQ_EE=true node "$REPO_ROOT/dist/apps/api-gateway/src/main.js" &
GATEWAY_PID=$!

# Ensure gateway is killed on exit
cleanup() {
  echo "==> Stopping test gateway (pid $GATEWAY_PID)..."
  kill "$GATEWAY_PID" 2>/dev/null || true
  wait "$GATEWAY_PID" 2>/dev/null || true
  rm -rf "$REPO_ROOT/node_modules/@roviq"
}
trap cleanup EXIT

# Wait for gateway to be ready
echo "==> Waiting for gateway to be ready..."
for i in $(seq 1 60); do
  if curl -sf -X POST "http://localhost:$TEST_PORT/api/graphql" -H 'Content-Type: application/json' -d '{"query":"{__typename}"}' >/dev/null 2>&1; then
    echo "==> Gateway ready on port $TEST_PORT"
    break
  fi
  if [ "$i" -eq 60 ]; then
    echo "ERROR: Gateway failed to start within 60s"
    exit 1
  fi
  sleep 1
done

# --- 3. Build temp vars file with test port ---
if [ "${1:-}" = "--paid" ]; then
  SRC_VARS="$REPO_ROOT/e2e/api-gateway-e2e/hurl/paid/vars.env"
  TEST_FILES="$REPO_ROOT/e2e/api-gateway-e2e/hurl/paid/*.hurl"
else
  SRC_VARS="$REPO_ROOT/e2e/api-gateway-e2e/hurl/vars.env"
  TEST_FILES="$REPO_ROOT/e2e/api-gateway-e2e/hurl/*.hurl"
fi

# Override base_url in a temp vars file
TEMP_VARS=$(mktemp)
trap 'rm -f "$TEMP_VARS"; cleanup' EXIT
sed "s|^base_url=.*|base_url=http://localhost:$TEST_PORT/api|" "$SRC_VARS" > "$TEMP_VARS"

echo "==> Running Hurl tests..."
# shellcheck disable=SC2086
hurl --test --jobs 1 \
  --variables-file "$TEMP_VARS" \
  $TEST_FILES
