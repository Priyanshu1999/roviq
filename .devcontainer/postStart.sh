#!/bin/bash
set -euo pipefail

echo "=== Roviq Dev Container: postStart ==="

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL..."
for i in $(seq 1 30); do
  if pg_isready -h postgres -U roviq -q 2>/dev/null; then
    echo "PostgreSQL is ready"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "ERROR: PostgreSQL not ready after 30 attempts"
    exit 1
  fi
  sleep 2
done

# Check if the database is already initialized (tables exist).
# First run:  db:reset --seed (full drop + push + GRANTs + FORCE RLS + seed)
# Subsequent: db:push only   (fast schema sync, preserves manual test data)
TABLE_COUNT=$(PGPASSWORD=roviq_dev psql -h postgres -U roviq -d roviq -tAc \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'" 2>/dev/null || echo "0")

if [ "$TABLE_COUNT" -gt "0" ]; then
  echo "Database already initialized ($TABLE_COUNT tables). Running schema sync..."
  for i in $(seq 1 5); do
    if pnpm run db:push 2>&1; then
      echo "Schema sync completed"
      break
    fi
    if [ "$i" -eq 5 ]; then
      echo "ERROR: Schema sync failed after 5 attempts"
      exit 1
    fi
    echo "Retrying db:push... (attempt $i/5)"
    sleep 3
  done
else
  # First run: db:reset applies the full four-role GRANT model including
  # table-specific restrictions (e.g., REVOKE UPDATE/DELETE on audit_logs
  # from roviq_app) that db:push alone does not handle.
  echo "First run — full database reset + seed..."
  for i in $(seq 1 5); do
    if pnpm run db:reset --seed 2>&1; then
      echo "Database reset + seed completed"
      break
    fi
    if [ "$i" -eq 5 ]; then
      echo "ERROR: Database reset failed after 5 attempts"
      exit 1
    fi
    echo "Retrying db:reset... (attempt $i/5)"
    sleep 3
  done
fi

echo ""
echo "=== Roviq Dev Container Ready ==="
echo ""
echo "  Dev servers:"
echo "    API Gateway:   pnpm run dev:gateway  (http://localhost:3000/api/graphql)"
echo "    Web App:       pnpm run dev:web      (http://localhost:4200)"
echo ""
echo "  E2E tests (start dev servers first):"
echo "    RLS tests:     pnpm test:int"
echo "    Vitest e2e:    pnpm test:e2e:api"
echo "    Hurl tests:    hurl --test --jobs 1 --variables-file e2e/api-gateway-e2e/hurl/vars.e2e.env e2e/api-gateway-e2e/hurl/**/*.hurl"
echo "    Playwright:    pnpm nx e2e web-admin-e2e"
echo "    All unit:      pnpm test"
echo ""
