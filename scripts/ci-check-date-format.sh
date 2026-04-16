#!/usr/bin/env bash
#
# CI guardrail: ban slash-separated date literals passed to new Date() or Date.parse().
#
# The DD/MM vs MM/DD footgun: India displays DD/MM/YYYY, JavaScript's Date
# constructor treats "10/12/2022" as MM/DD/YYYY (October 12), producing wrong
# dates silently. All date strings in production code must be ISO 8601
# (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ). Use parseISO() from date-fns, never
# new Date('<slash-separated>') or Date.parse('<slash-separated>').
#
# Flags:
#   new Date('10/12/2022')    ← banned: ambiguous locale
#   new Date("28/12/2022")    ← banned: ambiguous locale
#   Date.parse('12/28/2022')  ← banned: use parseISO instead
#
# Safe patterns (not flagged):
#   new Date()                ← current time, fine
#   new Date('2022-12-28')    ← ISO 8601, fine
#   new Date(isoString)       ← variable, not a string literal
#   parseISO('2022-12-28')    ← explicit, fine

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

# Match new Date('.../.../...') or Date.parse('.../.../...')
# inside .ts / .tsx files that are not test/spec files.
BAD="$(grep -Prn --include='*.ts' --include='*.tsx' \
  '(?:new\s+Date|Date\.parse)\s*\(\s*['"'"'"][0-9]{1,4}/[0-9]{1,2}' \
  apps/ libs/ 2>/dev/null \
  | grep -v '/node_modules/' \
  | grep -v '\.spec\.tsx\?$\|\.test\.tsx\?$\|__tests__/' \
  || true)"

if [ -n "$BAD" ]; then
  echo "Found slash-separated date literals passed to new Date() or Date.parse():"
  echo ""
  echo "$BAD"
  echo ""
  echo "Use ISO 8601 strings (YYYY-MM-DD) and parseISO() from date-fns."
  echo "See docs/frontend.md §Date contract for the full policy."
  exit 1
fi

echo "OK: no ambiguous slash-separated date literals found."
