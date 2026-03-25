# Auth: admin_token injected by auth-setup.sh
# ============================================================
# Admin Institute Reject Flow
# Tests the adminRejectInstitute mutation and verifies that
# REJECTED is a terminal state (no transitions out).
#
# Flow:
#   1. adminCreateInstitute (status=PENDING)
#   2. adminRejectInstitute with reason
#   3. Verify status is REJECTED
#   4. Verify cannot transition from REJECTED (terminal state)
#   5. Cleanup via adminDeleteInstitute
#
# Variables required: base_url, admin_token
# ============================================================

# Step 1: Create institute for rejection test
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "mutation AdminCreateInstitute($input: AdminCreateInstituteInput!) { adminCreateInstitute(input: $input) { id status setupStatus } }",
  "variables": {
    "input": {
      "name": { "en": "Reject Flow Test Institute" },
      "slug": "reject-flow-test-inst",
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

# Step 2: Reject the institute with a reason
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "mutation AdminRejectInstitute($id: ID!, $reason: String!) { adminRejectInstitute(id: $id, reason: $reason) { id status } }",
  "variables": {
    "id": "{{inst_id}}",
    "reason": "E2E test rejection — not a real institute"
  }
}
HTTP 200
[Asserts]
jsonpath "$.data.adminRejectInstitute.id" == {{inst_id}}
jsonpath "$.data.adminRejectInstitute.status" == "REJECTED"

# Step 3: Verify cannot activate from REJECTED (terminal state)
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

# Step 4: Verify cannot suspend from REJECTED (terminal state)
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "mutation { adminUpdateInstituteStatus(id: \"{{inst_id}}\", status: SUSPENDED) { id status } }"
}
HTTP 200
[Asserts]
jsonpath "$.errors" count >= 1
jsonpath "$.data" == null

# Step 5: Verify cannot deactivate from REJECTED (terminal state)
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "mutation { adminUpdateInstituteStatus(id: \"{{inst_id}}\", status: INACTIVE) { id status } }"
}
HTTP 200
[Asserts]
jsonpath "$.errors" count >= 1
jsonpath "$.data" == null

# Step 6: Cleanup — delete the rejected institute
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
