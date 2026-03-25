# Auth: admin_token injected by auth-setup.sh
# ============================================================
# Institute Status Lifecycle — State Machine Transitions
# Tests every valid transition and guards against invalid ones.
#
# Valid transitions:
#   PENDING  → ACTIVE (only if setupStatus==COMPLETED)
#   PENDING  → REJECTED (terminal)
#   ACTIVE   → INACTIVE
#   ACTIVE   → SUSPENDED
#   INACTIVE → ACTIVE
#   SUSPENDED → ACTIVE
#   REJECTED → * (terminal — no transitions out)
#
# Variables required: base_url, admin_token, institute_1_id
# institute_1_id must be ACTIVE with setupStatus==COMPLETED (seed institute)
# ============================================================

# Step 1: Create a new institute (will start as PENDING with setupStatus != COMPLETED)
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "mutation AdminCreateInstitute($input: AdminCreateInstituteInput!) { adminCreateInstitute(input: $input) { id status setupStatus } }",
  "variables": {
    "input": {
      "name": { "en": "Status Test Institute" },
      "slug": "status-test-institute",
      "type": "SCHOOL"
    }
  }
}
HTTP 200
[Captures]
new_institute_id: jsonpath "$.data.adminCreateInstitute.id"
[Asserts]
jsonpath "$.data.adminCreateInstitute.id" != null
jsonpath "$.data.adminCreateInstitute.status" == "PENDING"

# Step 2: Try to activate a PENDING institute with setupStatus != COMPLETED
# -- Must return an error (setup not complete)
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "mutation { adminUpdateInstituteStatus(id: \"{{new_institute_id}}\", status: ACTIVE) { id status setupStatus } }"
}
HTTP 200
[Asserts]
jsonpath "$.errors" count >= 1
jsonpath "$.data" == null

# Step 3: Reject the PENDING institute — status should become REJECTED
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "mutation AdminRejectInstitute($id: ID!, $reason: String!) { adminRejectInstitute(id: $id, reason: $reason) { id status setupStatus } }",
  "variables": {
    "id": "{{new_institute_id}}",
    "reason": "E2E status lifecycle test — rejecting PENDING institute"
  }
}
HTTP 200
[Asserts]
jsonpath "$.data.adminRejectInstitute.id" == {{new_institute_id}}
jsonpath "$.data.adminRejectInstitute.status" == "REJECTED"

# Step 4: Try to activate a REJECTED institute — must fail (terminal state, no transitions out)
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "mutation { adminUpdateInstituteStatus(id: \"{{new_institute_id}}\", status: ACTIVE) { id status setupStatus } }"
}
HTTP 200
[Asserts]
jsonpath "$.errors" count >= 1
jsonpath "$.errors[0].message" contains "Cannot transition from REJECTED to ACTIVE"
jsonpath "$.data" == null

# Step 5: Deactivate the seed institute (ACTIVE -> INACTIVE)
# institute_1_id is the seed institute: ACTIVE + setupStatus==COMPLETED
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "mutation { adminUpdateInstituteStatus(id: \"{{institute_1_id}}\", status: INACTIVE) { id status setupStatus } }"
}
HTTP 200
[Asserts]
jsonpath "$.data.adminUpdateInstituteStatus.id" == {{institute_1_id}}
jsonpath "$.data.adminUpdateInstituteStatus.status" == "INACTIVE"

# Step 6: Re-activate the seed institute (INACTIVE → ACTIVE)
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "mutation { adminUpdateInstituteStatus(id: \"{{institute_1_id}}\", status: ACTIVE) { id status setupStatus } }"
}
HTTP 200
[Asserts]
jsonpath "$.data.adminUpdateInstituteStatus.id" == {{institute_1_id}}
jsonpath "$.data.adminUpdateInstituteStatus.status" == "ACTIVE"

# Step 7: Suspend the seed institute (ACTIVE → SUSPENDED)
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "mutation { adminUpdateInstituteStatus(id: \"{{institute_1_id}}\", status: SUSPENDED) { id status setupStatus } }"
}
HTTP 200
[Asserts]
jsonpath "$.data.adminUpdateInstituteStatus.id" == {{institute_1_id}}
jsonpath "$.data.adminUpdateInstituteStatus.status" == "SUSPENDED"

# Step 8: Resume the seed institute from SUSPENDED (SUSPENDED → ACTIVE)
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "mutation { adminUpdateInstituteStatus(id: \"{{institute_1_id}}\", status: ACTIVE) { id status setupStatus } }"
}
HTTP 200
[Asserts]
jsonpath "$.data.adminUpdateInstituteStatus.id" == {{institute_1_id}}
jsonpath "$.data.adminUpdateInstituteStatus.status" == "ACTIVE"
jsonpath "$.data.adminUpdateInstituteStatus.setupStatus" == "COMPLETED"

# Step 9: Cleanup — delete the test institute
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "mutation AdminDeleteInstitute($id: ID!) { adminDeleteInstitute(id: $id) }",
  "variables": { "id": "{{new_institute_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.adminDeleteInstitute" == true
