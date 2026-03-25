#!/bin/sh
# Pre-authenticate all scopes and output --variable flags for hurl.
# Runs inside the hurl-tests container (Alpine/busybox — no curl/jq).
#
# Usage: AUTH_VARS=$(sh auth-setup.sh http://api-gateway:3004/api)
#        hurl --test $AUTH_VARS ...
set -e

BASE_URL="${1:-http://api-gateway:3004/api}"
GQL="$BASE_URL/graphql"

# Helper: POST GraphQL query, return response body
gql() {
  wget -qO- --header="Content-Type: application/json" \
    ${2:+--header="Authorization: Bearer $2"} \
    --post-data="$1" "$GQL"
}

# Extract a JSON string value by key (busybox-compatible, no jq)
json_val() {
  echo "$1" | sed -n "s/.*\"$2\":\"\([^\"]*\)\".*/\1/p"
}

# ── 1. Platform admin login ──────────────────────────────
admin_res=$(gql '{"query":"mutation { adminLogin(username: \"admin\", password: \"admin123\") { accessToken } }"}')
admin_token=$(json_val "$admin_res" "accessToken")

if [ -z "$admin_token" ]; then
  echo "ERROR: adminLogin failed: $admin_res" >&2
  exit 1
fi

# ── 2. Reseller login ────────────────────────────────────
reseller_res=$(gql '{"query":"mutation { resellerLogin(username: \"reseller1\", password: \"reseller123\") { accessToken } }"}')
reseller_token=$(json_val "$reseller_res" "accessToken")

if [ -z "$reseller_token" ]; then
  echo "ERROR: resellerLogin failed: $reseller_res" >&2
  exit 1
fi

# ── 3. Institute admin login (2-step: login → selectInstitute for institute 1) ──
# Use deterministic membership ID from seed (MEMBERSHIP_ADMIN_INST1)
ADMIN_MEMBERSHIP_INST1="00000000-0000-4000-a000-000000000401"

inst_login_res=$(gql '{"query":"mutation { instituteLogin(username: \"admin\", password: \"admin123\") { selectionToken memberships { membershipId } } }"}')
selection_token=$(json_val "$inst_login_res" "selectionToken")
membership_id="$ADMIN_MEMBERSHIP_INST1"

if [ -z "$selection_token" ]; then
  echo "ERROR: instituteLogin failed: $inst_login_res" >&2
  exit 1
fi

select_res=$(gql "{\"query\":\"mutation { selectInstitute(selectionToken: \\\"$selection_token\\\", membershipId: \\\"$membership_id\\\") { accessToken } }\"}" "$selection_token")
inst_token=$(json_val "$select_res" "accessToken")

if [ -z "$inst_token" ]; then
  echo "ERROR: selectInstitute failed: $select_res" >&2
  exit 1
fi

# ── 4. Teacher login (single-institute, direct accessToken) ──
teacher_res=$(gql '{"query":"mutation { instituteLogin(username: \"teacher1\", password: \"teacher123\") { accessToken } }"}')
teacher_token=$(json_val "$teacher_res" "accessToken")

if [ -z "$teacher_token" ]; then
  echo "ERROR: teacher instituteLogin failed: $teacher_res" >&2
  exit 1
fi

# ── Output as variables file (key=value, consumed by --variables-file) ──
echo "admin_token=$admin_token"
echo "reseller_token=$reseller_token"
echo "inst_token=$inst_token"
echo "teacher_token=$teacher_token"
echo "selection_token=$selection_token"
echo "membership_id=$membership_id"
