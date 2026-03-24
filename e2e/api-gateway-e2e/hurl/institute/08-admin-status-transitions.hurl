# ============================================================
# Admin Institute Status Transitions
# Tests all valid status transitions via adminUpdateInstituteStatus,
# plus the setup-not-complete guard on activation.
#
# Uses the seeded institute (institute_1_id) which is ACTIVE with
# setupStatus==COMPLETED for suspend/deactivate/reactivate flows.
# Creates a fresh institute to test the PENDING → ACTIVE guard.
#
# Valid transitions (from STATUS_TRANSITIONS):
#   PENDING    → ACTIVE (only if setupStatus==COMPLETED), REJECTED
#   ACTIVE     → INACTIVE, SUSPENDED
#   INACTIVE   → ACTIVE
#   SUSPENDED  → ACTIVE
#   REJECTED   → (terminal — no transitions out)
#
# Variables required: base_url, username, password, institute_1_id
# ============================================================

# Step 1: Admin login
POST {{base_url}}/graphql
Content-Type: application/json
{
  "query": "mutation { adminLogin(username: \"{{username}}\", password: \"{{password}}\") { accessToken } }"
}
HTTP 200
[Captures]
admin_token: jsonpath "$.data.adminLogin.accessToken"
[Asserts]
jsonpath "$.data.adminLogin.accessToken" != null

# Step 2: Create a fresh institute (starts as PENDING, setupStatus PENDING)
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "mutation AdminCreateInstitute($input: AdminCreateInstituteInput!) { adminCreateInstitute(input: $input) { id status setupStatus } }",
  "variables": {
    "input": {
      "name": { "en": "Admin Status Test Institute" },
      "slug": "admin-status-test-inst",
      "type": "SCHOOL"
    }
  }
}
HTTP 200
[Captures]
inst_id: jsonpath "$.data.adminCreateInstitute.id"
[Asserts]
jsonpath "$.data.adminCreateInstitute.id" != null
jsonpath "$.data.adminCreateInstitute.status" == "PENDING"

# Step 3: Try to activate the new institute (PENDING → ACTIVE)
# Should fail because setupStatus is not COMPLETED
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "mutation { adminUpdateInstituteStatus(id: \"{{inst_id}}\", status: ACTIVE) { id status } }"
}
HTTP 200
[Asserts]
jsonpath "$.errors" count >= 1
jsonpath "$.data" == null

# Step 4: Suspend the seeded institute (ACTIVE → SUSPENDED) with reason
# institute_1_id is the seed institute: ACTIVE + setupStatus==COMPLETED
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "mutation { adminUpdateInstituteStatus(id: \"{{institute_1_id}}\", status: SUSPENDED, reason: \"E2E test suspension\") { id status } }"
}
HTTP 200
[Asserts]
jsonpath "$.data.adminUpdateInstituteStatus.id" == {{institute_1_id}}
jsonpath "$.data.adminUpdateInstituteStatus.status" == "SUSPENDED"

# Step 5: Un-suspend (SUSPENDED → ACTIVE)
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "mutation { adminUpdateInstituteStatus(id: \"{{institute_1_id}}\", status: ACTIVE) { id status } }"
}
HTTP 200
[Asserts]
jsonpath "$.data.adminUpdateInstituteStatus.id" == {{institute_1_id}}
jsonpath "$.data.adminUpdateInstituteStatus.status" == "ACTIVE"

# Step 6: Deactivate (ACTIVE → INACTIVE)
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "mutation { adminUpdateInstituteStatus(id: \"{{institute_1_id}}\", status: INACTIVE) { id status } }"
}
HTTP 200
[Asserts]
jsonpath "$.data.adminUpdateInstituteStatus.id" == {{institute_1_id}}
jsonpath "$.data.adminUpdateInstituteStatus.status" == "INACTIVE"

# Step 7: Reactivate (INACTIVE → ACTIVE)
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "mutation { adminUpdateInstituteStatus(id: \"{{institute_1_id}}\", status: ACTIVE) { id status } }"
}
HTTP 200
[Asserts]
jsonpath "$.data.adminUpdateInstituteStatus.id" == {{institute_1_id}}
jsonpath "$.data.adminUpdateInstituteStatus.status" == "ACTIVE"

# Step 8: Verify invalid transition — try to SUSPEND an already-ACTIVE institute twice
# First suspend again
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "mutation { adminUpdateInstituteStatus(id: \"{{institute_1_id}}\", status: SUSPENDED) { id status } }"
}
HTTP 200
[Asserts]
jsonpath "$.data.adminUpdateInstituteStatus.status" == "SUSPENDED"

# Try INACTIVE from SUSPENDED (not allowed — SUSPENDED can only go to ACTIVE)
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "mutation { adminUpdateInstituteStatus(id: \"{{institute_1_id}}\", status: INACTIVE) { id status } }"
}
HTTP 200
[Asserts]
jsonpath "$.errors" count >= 1
jsonpath "$.errors[0].message" contains "Cannot transition from SUSPENDED to INACTIVE"
jsonpath "$.data" == null

# Restore seed institute back to ACTIVE for other tests
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "mutation { adminUpdateInstituteStatus(id: \"{{institute_1_id}}\", status: ACTIVE) { id status } }"
}
HTTP 200
[Asserts]
jsonpath "$.data.adminUpdateInstituteStatus.status" == "ACTIVE"

# Step 9: Cleanup — delete the test institute
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "mutation AdminDeleteInstitute($id: ID!) { adminDeleteInstitute(id: $id) }",
  "variables": { "id": "{{inst_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.adminDeleteInstitute" == true
