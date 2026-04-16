#!/usr/bin/env bash
#
# CI guardrail: every static .skip()/.todo() in a test file must reference a
# Linear issue (ROV-xxx). Prevents tests from being silently skipped without
# a tracked follow-up.
#
# Only flags STATIC skips where the first argument is a string literal:
#     test.skip('should handle edge case', ...)    ← flagged
#     it.todo('not implemented yet')               ← flagged
#     describe.skip('suite blocked', () => ...)    ← flagged
#
# Allows (does NOT flag):
#   - Runtime conditional skips:   test.skip(rowCount === 0, 'no seeded data')
#   - Multi-line skip openings:    test.skip(  ← first arg on next line
#   - Any line containing ROV-xxx
#   - Comment lines (JSDoc `*`, single-line `//`)
#
# ─────────────────────────────────────────────────────────────────────────────
# DEFERRED: not yet wired into CI.
#
# When this script first ran against develop it flagged ~22 pre-existing
# orphaned skips (impersonation UI/API placeholders, billing workflow todos,
# bonafide certificate, <ImpersonationBanner> component). These are tracked
# under ROV-233 — tag each flagged skip with its issue ID first, then wire
# this script into CI (see ROV-233 for the checklist).
#
# To wire into CI after cleanup:
#   1. Add `"test:check-skips": "bash scripts/ci-check-skips.sh"` to package.json.
#   2. Add a step to `.github/workflows/ci.yml` that runs `pnpm test:check-skips`
#      (cheap — pure grep, no install needed beyond checkout).
#   3. Remove this DEFERRED block.
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

ORPHANED="$(grep -Prn --include='*.spec.ts' --include='*.spec.tsx' \
                    --include='*.e2e.spec.ts' --include='*.api-e2e.spec.ts' \
                    --include='*.integration.spec.ts' \
  '\.(skip|todo)\s*\(' \
  apps/ libs/ ee/ e2e/ 2>/dev/null \
  | grep -v '/node_modules/' \
  | grep -Pv ':\s*\*' \
  | grep -Pv ':\s*//' \
  | grep -Pv '\.(skip|todo)\s*\(\s*$' \
  | grep -Pv '\.(skip|todo)\s*\([^'\''"`]+,' \
  | grep -v 'ROV-' \
  || true)"

if [ -n "$ORPHANED" ]; then
  echo "Found skipped/todo tests without a Linear issue reference (ROV-xxx):"
  echo ""
  echo "$ORPHANED"
  echo ""
  echo "Every static .skip()/.todo() must reference a ROV-xxx issue."
  echo "Example:"
  echo "    it.skip('handles edge case — ROV-234: blocked by auth refactor')"
  echo "    describe.skip('TC clearance (ROV-232 — workflow worker missing)', ...)"
  echo ""
  echo "Runtime conditional skips like test.skip(condition, 'reason') are allowed."
  exit 1
fi

echo "OK: no orphaned .skip/.todo found."
