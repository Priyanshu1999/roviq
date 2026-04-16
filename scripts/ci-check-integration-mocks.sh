#!/usr/bin/env bash
#
# CI guardrail: files named *.integration.spec.ts must NOT mock the database.
# Integration tests exist specifically to exercise the real RLS → Drizzle →
# Postgres pipeline. A mocked DB in an integration file is a unit test wearing
# the wrong hat — rename it to *.spec.ts.
#
# Flags patterns that unambiguously mock the DB layer:
#   - createMock<...Drizzle...>, createMock<...Database...>, createMock<...Pool...>
#   - vi.fn().*query(...)      — typical drizzle mock shape
#   - vi.fn().*execute(...)    — typical drizzle mock shape
#
# Mocking non-DB collaborators in an integration file is still allowed:
#   createMock<ConfigService>()    ← OK
#   createMock<CaslAbilityFactory>() ← OK

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

BAD="$(grep -Prn --include='*.integration.spec.ts' \
  'createMock\s*<[^>]*(?:Drizzle|Database|Pool)[^>]*>|vi\.fn\s*\(\s*\)\s*\.\s*mock(?:Resolved|Implementation)?\s*\([^)]*(?:query|execute)\s*:' \
  apps/ libs/ ee/ 2>/dev/null \
  | grep -v '/node_modules/' \
  || true)"

if [ -n "$BAD" ]; then
  echo "Found database mocks in integration test files:"
  echo ""
  echo "$BAD"
  echo ""
  echo "Integration tests (*.integration.spec.ts) must hit a real database."
  echo "If this file genuinely needs a DB mock, rename it to *.spec.ts (unit test)."
  exit 1
fi

echo "OK: all integration tests use real database connections."
