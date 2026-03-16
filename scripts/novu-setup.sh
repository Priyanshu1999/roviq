#!/usr/bin/env bash
# Automated local Novu setup — run once after starting the novu Tilt group.
# Idempotent: safe to re-run. Skips steps that are already done.
#
# What it does:
#   1. Waits for Novu API to be healthy
#   2. Registers a local admin account (skips if already exists)
#   3. Retrieves the Development API key + app identifier
#   4. Updates .env with NOVU_SECRET_KEY, NOVU_APPLICATION_IDENTIFIER, NEXT_PUBLIC_* vars
#   5. Removes "Inbox by Novu" branding
#   6. Syncs the bridge (if notification-service is running)
#
# Usage:
#   scripts/novu-setup.sh                # full setup
#   scripts/novu-setup.sh --skip-bridge  # skip bridge sync (notification-service not running)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NOVU_API="http://localhost:3340"
NOVU_EMAIL="admin@roviq.local"
NOVU_PASSWORD="RoviqLocal123!@#"
NOVU_ORG="Roviq"

# ─── Helpers ─────────────────────────────────────────────────────────────────

info()  { echo "==> $*"; }
ok()    { echo "  ✓ $*"; }
skip()  { echo "  - $* (skipped)"; }

# ─── 1. Wait for Novu API ────────────────────────────────────────────────────

info "Waiting for Novu API..."
for i in $(seq 1 30); do
  if curl -sf "$NOVU_API/v1/health-check" > /dev/null 2>&1; then
    ok "Novu API healthy"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "ERROR: Novu API not reachable at $NOVU_API after 60s"
    echo "       Start it via Tilt UI (novu label group)"
    exit 1
  fi
  sleep 2
done

# ─── 2. Register local admin ─────────────────────────────────────────────────

info "Registering local Novu admin..."
REGISTER_RESULT=$(curl -s -X POST "$NOVU_API/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"firstName\": \"Roviq\",
    \"lastName\": \"Admin\",
    \"email\": \"$NOVU_EMAIL\",
    \"password\": \"$NOVU_PASSWORD\",
    \"organizationName\": \"$NOVU_ORG\"
  }" 2>&1)

if echo "$REGISTER_RESULT" | grep -q '"token"'; then
  ok "Admin account created"
elif echo "$REGISTER_RESULT" | grep -q "already exists"; then
  skip "Admin account already exists"
else
  STATUS=$(echo "$REGISTER_RESULT" | python3 -c "import json,sys; print(json.load(sys.stdin).get('statusCode',''))" 2>/dev/null || echo "")
  if [ "$STATUS" = "500" ]; then
    echo "ERROR: Registration failed (500). Check STORE_ENCRYPTION_KEY is exactly 32 chars."
    echo "$REGISTER_RESULT"
    exit 1
  fi
  echo "ERROR: Unexpected registration response:"
  echo "$REGISTER_RESULT"
  exit 1
fi

# ─── 3. Get API key + app identifier ─────────────────────────────────────────

info "Retrieving API credentials..."
NOVU_JWT=$(curl -s -X POST "$NOVU_API/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$NOVU_EMAIL\", \"password\": \"$NOVU_PASSWORD\"}" \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['data']['token'])")

ENV_DATA=$(curl -s "$NOVU_API/v1/environments" \
  -H "Authorization: Bearer $NOVU_JWT")

API_KEY=$(echo "$ENV_DATA" | python3 -c "import json,sys; print(json.load(sys.stdin)['data'][0]['apiKeys'][0]['key'])")
APP_ID=$(echo "$ENV_DATA" | python3 -c "import json,sys; print(json.load(sys.stdin)['data'][0]['identifier'])")

ok "API Key: ${API_KEY:0:12}..."
ok "App ID:  $APP_ID"

# ─── 4. Update .env ──────────────────────────────────────────────────────────

info "Updating .env..."
ENV_FILE="$REPO_ROOT/.env"

update_env() {
  local key="$1" value="$2"
  if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
  else
    echo "${key}=${value}" >> "$ENV_FILE"
  fi
}

update_env "NOVU_SECRET_KEY" "$API_KEY"
update_env "NOVU_APPLICATION_IDENTIFIER" "$APP_ID"
update_env "NEXT_PUBLIC_NOVU_APPLICATION_IDENTIFIER" "$APP_ID"
update_env "NEXT_PUBLIC_NOVU_BACKEND_URL" "http://localhost:3340"
update_env "NEXT_PUBLIC_NOVU_SOCKET_URL" "http://localhost:3342"

ok ".env updated"

# ─── 5. Remove Novu branding ─────────────────────────────────────────────────

info "Removing Novu branding..."
docker exec docker-mongodb-1 mongosh --quiet --eval "
  db = db.getSiblingDB('novu');
  db.organizations.updateMany({}, { \$set: { removeNovuBranding: true, apiServiceLevel: 'business' } });
" > /dev/null 2>&1
ok "Branding removed"

# ─── 6. Sync bridge ──────────────────────────────────────────────────────────

if [ "${1:-}" = "--skip-bridge" ]; then
  skip "Bridge sync (--skip-bridge)"
else
  info "Syncing bridge..."
  if ! curl -sf http://localhost:3002/api/novu > /dev/null 2>&1; then
    skip "Bridge sync (notification-service not running on :3002)"
    echo "       Run 'pnpm run dev:notifications' then re-run this script or trigger novu-sync-bridge in Tilt"
  else
    HOST_IP=$(ip addr show eth0 2>/dev/null | grep "inet " | awk '{print $2}' | cut -d/ -f1)
    if [ -z "$HOST_IP" ]; then HOST_IP="host.docker.internal"; fi

    SYNC_RESULT=$(curl -s -X POST "$NOVU_API/v1/bridge/sync?source=cli" \
      -H "Authorization: ApiKey $API_KEY" \
      -H "Content-Type: application/json" \
      -d "{\"bridgeUrl\": \"http://${HOST_IP}:3002/api/novu\"}" 2>&1)

    WORKFLOW_COUNT=$(echo "$SYNC_RESULT" | python3 -c "import json,sys; print(len(json.load(sys.stdin).get('data',[])))" 2>/dev/null || echo "0")
    if [ "$WORKFLOW_COUNT" -gt 0 ]; then
      ok "$WORKFLOW_COUNT workflows synced"
    else
      echo "  WARNING: Bridge sync returned unexpected result:"
      echo "  $SYNC_RESULT" | head -3
    fi
  fi
fi

# ─── Done ─────────────────────────────────────────────────────────────────────

echo ""
echo "Novu local setup complete!"
echo "  Dashboard:  http://localhost:4000"
echo "  API:        $NOVU_API"
echo "  App ID:     $APP_ID"
echo ""
echo "If you changed .env, restart admin-portal/institute-portal to pick up NEXT_PUBLIC_* vars."
