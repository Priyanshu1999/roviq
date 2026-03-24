# ============================================================
# Reseller Suspend / Reactivate Institute
# Tests: resellerSuspendInstitute, resellerReactivateInstitute
# Uses seeded Demo Institute (institute_1_id) — must be ACTIVE
# ============================================================

# Step 1: Reseller login
POST {{base_url}}/graphql
Content-Type: application/json
{
  "query": "mutation { resellerLogin(username: \"{{reseller_username}}\", password: \"{{reseller_password}}\") { accessToken } }"
}
HTTP 200
[Captures]
reseller_token: jsonpath "$.data.resellerLogin.accessToken"
[Asserts]
jsonpath "$.data.resellerLogin.accessToken" != null

# Step 2: Verify seeded institute is ACTIVE before suspending
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

# Step 3: Suspend the seeded institute (ACTIVE -> SUSPENDED)
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

# Step 4: Verify institute is now SUSPENDED via get
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

# Step 5: Reactivate the institute (SUSPENDED -> ACTIVE)
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

# Step 6: Verify institute is ACTIVE again
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
