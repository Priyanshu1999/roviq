#!/bin/bash
set -euo pipefail

COMPOSE_PROJECT=roviq
COMPOSE_FILE=/app/compose.yaml

log() { echo "[roviq] $*"; }

# Clean shutdown handler
cleanup() {
  log "Shutting down..."
  docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" down --remove-orphans 2>/dev/null || true
  log "Stopped."
  exit 0
}
trap cleanup SIGTERM SIGINT

# Export version for compose interpolation
export ROVIQ_VERSION="${ROVIQ_VERSION:-latest}"

# 1. Start infra
log "Starting Roviq platform..."
docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" up -d postgres redis nats minio temporal temporal-ui

# 2. Wait for health checks
log "Waiting for infrastructure..."
for svc in postgres redis nats; do
  retries=0
  until docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" ps "$svc" --format json 2>/dev/null | grep -q '"healthy"'; do
    retries=$((retries + 1))
    if [ "$retries" -ge 60 ]; then
      log "ERROR: $svc failed to become healthy after 120s"
      cleanup
    fi
    sleep 2
  done
  display_name="$(echo "$svc" | sed 's/^./\U&/')"
  log "✓ $display_name ready"
done

for svc in minio temporal; do
  display_name="$(echo "$svc" | sed 's/^./\U&/')"
  log "✓ $display_name ready"
done

# 3. Run migrations (one-shot migrator container)
log "Running migrations..."
docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" run --rm migrator
log "✓ Migrations applied"

# 4. Run seed (one-shot migrator container with seed command)
log "Seeding database..."
docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" run --rm -w /app migrator pnpx tsx scripts/seed.ts
log "✓ Seed data loaded"

# 5. Start app containers
docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" up -d api-gateway admin-portal institute-portal

# Wait briefly for apps to start
sleep 5

log "✓ API Gateway ready       → http://localhost:3000/api/graphql"
log "✓ Admin Portal ready      → http://localhost:4200"
log "✓ Institute Portal ready  → http://localhost:4300"
log ""
log "Roviq is running!"
log ""
log "  Demo credentials:"
log "    admin    / admin123   (2 orgs — shows org picker)"
log "    teacher1 / teacher123 (1 org — direct login)"
log "    student1 / student123 (1 org — direct login)"

# 6. Tail logs (keeps container alive)
docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" logs -f &
LOGS_PID=$!
wait $LOGS_PID
