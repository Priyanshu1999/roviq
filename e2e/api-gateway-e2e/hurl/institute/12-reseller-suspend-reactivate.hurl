# Auth: reseller_token injected by auth-setup.sh
# ============================================================
# Reseller Suspend / Reactivate Institute
# Tests: resellerSuspendInstitute, resellerReactivateInstitute
# Uses seeded Saraswati Vidya Mandir (institute_1_id) — must be ACTIVE
# ============================================================

# Step 1: Verify seeded institute is ACTIVE before suspending
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{reseller_token}}
{
  "query": "query ResellerGetInstitute($id: ID!) { resellerGetInstitute(id: $id) { id status } }",
  "variables": { "id": "{{institute_1_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.resellerGetInstitute.id" == {{institute_1_id}}
jsonpath "$.data.resellerGetInstitute.status" == "ACTIVE"

# Step 2: Suspend the seeded institute (ACTIVE -> SUSPENDED)
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{reseller_token}}
{
  "query": "mutation ResellerSuspend($id: ID!, $reason: String) { resellerSuspendInstitute(id: $id, reason: $reason) { id status } }",
  "variables": { "id": "{{institute_1_id}}", "reason": "E2E test suspension" }
}
HTTP 200
[Asserts]
jsonpath "$.data.resellerSuspendInstitute.id" == {{institute_1_id}}
jsonpath "$.data.resellerSuspendInstitute.status" == "SUSPENDED"

# Step 3: Verify institute is now SUSPENDED via get
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{reseller_token}}
{
  "query": "query ResellerGetInstitute($id: ID!) { resellerGetInstitute(id: $id) { id status } }",
  "variables": { "id": "{{institute_1_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.resellerGetInstitute.id" == {{institute_1_id}}
jsonpath "$.data.resellerGetInstitute.status" == "SUSPENDED"

# Step 4: Reactivate the institute (SUSPENDED -> ACTIVE)
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{reseller_token}}
{
  "query": "mutation ResellerReactivate($id: ID!) { resellerReactivateInstitute(id: $id) { id status } }",
  "variables": { "id": "{{institute_1_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.resellerReactivateInstitute.id" == {{institute_1_id}}
jsonpath "$.data.resellerReactivateInstitute.status" == "ACTIVE"

# Step 5: Verify institute is ACTIVE again
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{reseller_token}}
{
  "query": "query ResellerGetInstitute($id: ID!) { resellerGetInstitute(id: $id) { id status } }",
  "variables": { "id": "{{institute_1_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.resellerGetInstitute.id" == {{institute_1_id}}
jsonpath "$.data.resellerGetInstitute.status" == "ACTIVE"
