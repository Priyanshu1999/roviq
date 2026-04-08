#!/usr/bin/env bash
# Automated Novu setup — works for both host/Tilt dev and the E2E Docker stack.
# Idempotent: safe to re-run. Skips steps that are already done.
#
# What it does:
#   1. Waits for Novu API to be healthy
#   2. Registers an admin account (skips if already exists)
#   3. Retrieves the Development API key + app identifier
#   4. Writes credentials (mode-dependent: host .env or shared volume file)
#   5. Removes "Inbox by Novu" branding (host mode only — uses docker exec)
#   6. Syncs the bridge from notification-service
#
# Modes:
#   host   — writes NOVU_* to repo-root .env, bridge URL uses host IP (ip route),
#            MongoDB branding hack runs via `docker exec docker-mongodb-1`.
#            Uses http://localhost:3340 by default. For Tilt-managed dev stack.
#   docker — writes NOVU_* as `export FOO=bar` lines to $SHARED_CREDS_PATH
#            (default /shared/novu-creds.env), bridge URL uses notification-service
#            Docker service name. No MongoDB exec hack.
#            Uses http://novu-api:3000 by default. For compose.e2e.yaml bootstrap.
#
# Usage:
#   scripts/novu-setup.sh                     # host mode (default)
#   scripts/novu-setup.sh --skip-bridge       # host mode, skip bridge sync
#   scripts/novu-setup.sh --docker            # e2e Docker bootstrap mode
#   scripts/novu-setup.sh --docker --skip-bridge
#
# Env overrides (any mode):
#   NOVU_API           — Novu API base URL
#   NOVU_EMAIL         — admin account email
#   NOVU_PASSWORD      — admin account password (32+ chars safe)
#   NOVU_ORG           — organization name
#   NOTIF_SVC          — notification-service base URL (for bridge sync)
#   SHARED_CREDS_PATH  — output file (docker mode only)
#
# Dependencies:
#   host mode   — curl, jq, docker (for branding hack)
#   docker mode — curl, jq, sh-compatible shell (runs inside alpine container)
set -eu

# ─── Parse args ──────────────────────────────────────────────────────────────
MODE="host"
SKIP_BRIDGE=0
for arg in "$@"; do
  case "$arg" in
    --docker|--e2e) MODE="docker" ;;
    --skip-bridge)  SKIP_BRIDGE=1 ;;
    *)              echo "Unknown arg: $arg" >&2; exit 2 ;;
  esac
done

# ─── Defaults (mode-dependent) ───────────────────────────────────────────────
if [ "$MODE" = "docker" ]; then
  NOVU_API="${NOVU_API:-http://novu-api:3000}"
  NOTIF_SVC="${NOTIF_SVC:-http://notification-service:3002}"
  SHARED_CREDS_PATH="${SHARED_CREDS_PATH:-/shared/novu-creds.env}"
  NOVU_EMAIL="${NOVU_EMAIL:-admin@roviq.test}"
  NOVU_PASSWORD="${NOVU_PASSWORD:-RoviqE2E123!@#}"
  NOVU_ORG="${NOVU_ORG:-Roviq E2E}"
else
  NOVU_API="${NOVU_API:-http://localhost:3340}"
  NOTIF_SVC="${NOTIF_SVC:-http://localhost:3002}"
  NOVU_EMAIL="${NOVU_EMAIL:-admin@roviq.local}"
  NOVU_PASSWORD="${NOVU_PASSWORD:-RoviqLocal123!@#}"
  NOVU_ORG="${NOVU_ORG:-Roviq}"
  REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
fi

# ─── Helpers ─────────────────────────────────────────────────────────────────

info()  { echo "==> $*" >&2; }
ok()    { echo "  ✓ $*" >&2; }
skip()  { echo "  - $* (skipped)" >&2; }
fatal() { echo "  ✗ ERROR: $*" >&2; exit 1; }

# Sanity-check jq is available (both modes need it)
if ! command -v jq >/dev/null 2>&1; then
  fatal "jq is required but not installed. host: 'apt install jq' / 'brew install jq'. docker: ensure alpine has 'apk add --no-cache jq'."
fi

# ─── 1. Wait for Novu API ────────────────────────────────────────────────────

info "Waiting for Novu API at $NOVU_API..."
i=0
while [ "$i" -lt 60 ]; do
  if curl -sf -m 2 "$NOVU_API/v1/health-check" > /dev/null 2>&1; then
    ok "Novu API healthy"
    break
  fi
  i=$((i + 1))
  sleep 2
done
if [ "$i" -ge 60 ]; then
  if [ "$MODE" = "host" ]; then
    fatal "Novu API not reachable at $NOVU_API after 120s. Start it via Tilt UI (novu label group)."
  else
    fatal "Novu API not reachable at $NOVU_API after 120s. Is novu-api healthy in compose.e2e.yaml?"
  fi
fi

# ─── 2. Register admin (idempotent) ──────────────────────────────────────────

info "Registering Novu admin..."
REGISTER_RESULT=$(curl -s -X POST "$NOVU_API/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"firstName\": \"Roviq\",
    \"lastName\": \"Admin\",
    \"email\": \"$NOVU_EMAIL\",
    \"password\": \"$NOVU_PASSWORD\",
    \"organizationName\": \"$NOVU_ORG\"
  }")

if echo "$REGISTER_RESULT" | jq -e '.data.token' >/dev/null 2>&1; then
  ok "Admin account created"
elif echo "$REGISTER_RESULT" | grep -q "already exists\|EMAIL_ALREADY_EXISTS"; then
  skip "Admin account already exists"
else
  STATUS=$(echo "$REGISTER_RESULT" | jq -r '.statusCode // empty' 2>/dev/null || echo "")
  if [ "$STATUS" = "500" ]; then
    echo "ERROR: Registration failed (500). Check STORE_ENCRYPTION_KEY is exactly 32 chars." >&2
  fi
  fatal "Unexpected registration response: $REGISTER_RESULT"
fi

# ─── 3. Get API key + app identifier ─────────────────────────────────────────

info "Retrieving API credentials..."
LOGIN_RESULT=$(curl -s -X POST "$NOVU_API/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$NOVU_EMAIL\", \"password\": \"$NOVU_PASSWORD\"}")

NOVU_JWT=$(echo "$LOGIN_RESULT" | jq -r '.data.token // empty')
if [ -z "$NOVU_JWT" ]; then
  fatal "Login failed: $LOGIN_RESULT"
fi

ENV_DATA=$(curl -s "$NOVU_API/v1/environments" \
  -H "Authorization: Bearer $NOVU_JWT")

API_KEY=$(echo "$ENV_DATA" | jq -r '.data[0].apiKeys[0].key // empty')
APP_ID=$(echo "$ENV_DATA" | jq -r '.data[0].identifier // empty')

if [ -z "$API_KEY" ] || [ -z "$APP_ID" ]; then
  fatal "Could not extract API key or identifier from: $ENV_DATA"
fi

ok "API Key: ${API_KEY%%-*}-..."
ok "App ID:  $APP_ID"

# ─── 4. Write credentials ────────────────────────────────────────────────────

if [ "$MODE" = "host" ]; then
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
else
  info "Writing credentials to shared volume: $SHARED_CREDS_PATH"
  mkdir -p "$(dirname "$SHARED_CREDS_PATH")"
  cat > "$SHARED_CREDS_PATH" <<EOF
# Generated by scripts/novu-setup.sh --docker at $(date -u +%Y-%m-%dT%H:%M:%SZ)
# Consumers (api-gateway, notification-service, hurl) source this file before exec.
# NOVU_API_URL is the bare base URL (no /v1 suffix). Consumers append /v1/...
export NOVU_SECRET_KEY="$API_KEY"
export NOVU_APPLICATION_IDENTIFIER="$APP_ID"
export NOVU_API_URL="$NOVU_API"
export NOVU_MODE="local"
EOF
  ok "Credentials written"
fi

# ─── 5. Remove Novu branding (host mode only) ────────────────────────────────
# Cosmetic. Docker mode skips because the exec hack assumes a specific
# Tilt-managed mongodb container name.

if [ "$MODE" = "host" ]; then
  info "Removing Novu branding..."
  if docker exec docker-mongodb-1 mongosh --quiet --eval "
    db = db.getSiblingDB('novu');
    db.organizations.updateMany({}, { \$set: { removeNovuBranding: true, apiServiceLevel: 'business' } });
  " > /dev/null 2>&1; then
    ok "Branding removed"
  else
    skip "Branding removal (mongosh exec failed — cosmetic only)"
  fi
else
  skip "Branding removal (docker mode)"
fi

# ─── 6. Sync bridge ──────────────────────────────────────────────────────────

if [ "$SKIP_BRIDGE" -eq 1 ]; then
  skip "Bridge sync (--skip-bridge)"
else
  info "Syncing bridge..."

  # Resolve bridge URL per-mode
  if [ "$MODE" = "host" ]; then
    BRIDGE_HEALTH="http://localhost:3002/api/novu"
    # Host IP reachable from Docker containers — interface-agnostic
    HOST_IP=$(ip route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src") print $(i+1)}')
    if [ -z "$HOST_IP" ]; then HOST_IP="host.docker.internal"; fi
    BRIDGE_URL="http://${HOST_IP}:3002/api/novu"
  else
    BRIDGE_HEALTH="$NOTIF_SVC/api/novu"
    BRIDGE_URL="$NOTIF_SVC/api/novu"
  fi

  # Wait briefly — notification-service may still be starting in docker mode.
  i=0
  while [ "$i" -lt 30 ]; do
    if curl -sf -m 2 "$BRIDGE_HEALTH" > /dev/null 2>&1; then
      break
    fi
    i=$((i + 1))
    sleep 2
  done

  if [ "$i" -ge 30 ]; then
    if [ "$MODE" = "host" ]; then
      skip "Bridge sync (notification-service not reachable at $BRIDGE_HEALTH)"
      echo "       Run 'pnpm run dev:notifications' then re-run this script" >&2
    else
      skip "Bridge sync (notification-service not reachable at $BRIDGE_HEALTH after 60s)"
      echo "       Novu tests that require registered workflows will fail" >&2
    fi
  else
    SYNC_RESULT=$(curl -s -m 30 -X POST "$NOVU_API/v1/bridge/sync?source=cli" \
      -H "Authorization: ApiKey $API_KEY" \
      -H "Content-Type: application/json" \
      -d "{\"bridgeUrl\": \"$BRIDGE_URL\"}")

    WORKFLOW_COUNT=$(echo "$SYNC_RESULT" | jq -r '.data | length' 2>/dev/null || echo "0")
    if [ "$WORKFLOW_COUNT" -gt 0 ]; then
      ok "$WORKFLOW_COUNT workflows synced"
    else
      echo "  WARNING: Bridge sync returned unexpected result:" >&2
      echo "  $SYNC_RESULT" | head -3 >&2
    fi
  fi
fi

# ─── Done ─────────────────────────────────────────────────────────────────────

echo "" >&2
if [ "$MODE" = "host" ]; then
  echo "Novu local setup complete!" >&2
  echo "  Dashboard:  http://localhost:4000" >&2
  echo "  API:        $NOVU_API" >&2
  echo "  App ID:     $APP_ID" >&2
  echo "" >&2
  echo "If you changed .env, restart apps/web to pick up NEXT_PUBLIC_* vars." >&2
else
  echo "Novu E2E bootstrap complete!" >&2
  echo "  API:        $NOVU_API" >&2
  echo "  App ID:     $APP_ID" >&2
  echo "  Creds file: $SHARED_CREDS_PATH" >&2
fi
