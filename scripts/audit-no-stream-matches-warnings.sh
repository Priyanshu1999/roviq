#!/usr/bin/env bash
# ROV-252 — quantify "no stream matches subject" warnings in production
# api-gateway logs. Run with prod credentials available (Loki / Grafana
# Tempo / CloudWatch / your shipper of choice). Output is grouped by
# affected subject prefix so reviewers can attribute counts to the
# 11 prefixes the ROV-245 typed registry closed.
#
# Usage:
#   LOKI_URL=https://grafana.internal/api/datasources/proxy/$DS \
#   LOKI_TOKEN=... \
#   ROV245_DEPLOY=2026-05-01T00:00:00Z \
#     bash scripts/audit-no-stream-matches-warnings.sh
#
# Output: a CSV per prefix with `count_pre_deploy,count_post_deploy`.
#
# If your shipper isn't Loki, the LogQL queries below translate
# directly to CloudWatch Insights / Datadog log query syntax — only
# the wire format changes.

set -euo pipefail

: "${LOKI_URL:?Set LOKI_URL to your Loki proxy endpoint}"
: "${LOKI_TOKEN:?Set LOKI_TOKEN (bearer or basic auth)}"
: "${ROV245_DEPLOY:?Set ROV245_DEPLOY to the deploy timestamp (ISO-8601)}"

PREFIXES=(STANDARD BOT ATTENDANCE_SESSION ATTENDANCE_ENTRY CONSENT \
          CERTIFICATE TC EXPORT USER GUARDIAN STAFF)

# 90-day window ending at the ROV-245 deploy (pre-deploy)
PRE_START=$(date -u -d "$ROV245_DEPLOY -90 days" +%s)
PRE_END=$(date -u -d "$ROV245_DEPLOY" +%s)
# Same length post-deploy, capped at "now"
NOW=$(date -u +%s)
POST_START=$PRE_END
POST_END=$(( NOW < (PRE_END + 90 * 86400) ? NOW : PRE_END + 90 * 86400 ))

run_query() {
  local query="$1"
  local start_ns="$2"
  local end_ns="$3"
  curl -s -G "$LOKI_URL/loki/api/v1/query_range" \
    -H "Authorization: Bearer $LOKI_TOKEN" \
    --data-urlencode "query=$query" \
    --data-urlencode "start=${start_ns}000000000" \
    --data-urlencode "end=${end_ns}000000000" \
    --data-urlencode "limit=5000" \
    | jq -r '.data.result | length'
}

echo "prefix,count_pre_deploy,count_post_deploy"
for prefix in "${PREFIXES[@]}"; do
  query='{service="api-gateway"} |= "no stream matches subject" |~ "'"$prefix"'\\."'
  pre=$(run_query "$query" "$PRE_START" "$PRE_END" || echo "?")
  post=$(run_query "$query" "$POST_START" "$POST_END" || echo "?")
  echo "$prefix,$pre,$post"
done
