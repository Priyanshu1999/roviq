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
# Variables required: base_url, username, password, institute_1_id
# institute_1_id must be ACTIVE with setupStatus==COMPLETED (seed institute)
# ============================================================

# Step 1: Institute login
POST {{base_url}}/graphql
Content-Type: application/json
{
  "query": "mutation { instituteLogin(username: \"{{username}}\", password: \"{{password}}\") { requiresInstituteSelection selectionToken userId memberships { membershipId tenantId } } }"
}
HTTP 200
[Captures]
membership_id: jsonpath "$.data.instituteLogin.memberships[0].membershipId"
selection_token: jsonpath "$.data.instituteLogin.selectionToken"
user_id: jsonpath "$.data.instituteLogin.userId"
tenant_id: jsonpath "$.data.instituteLogin.memberships[0].tenantId"
[Asserts]
jsonpath "$.data.instituteLogin.requiresInstituteSelection" == true

# Step 2: Select institute → get accessToken
POST {{base_url}}/graphql
Content-Type: application/json
{
  "query": "mutation SelectInstitute($selectionToken: String!, $membershipId: String!) { selectInstitute(selectionToken: $selectionToken, membershipId: $membershipId) { accessToken } }",
  "variables": { "selectionToken": "{{selection_token}}", "membershipId": "{{membership_id}}" }
}
HTTP 200
[Captures]
access_token: jsonpath "$.data.selectInstitute.accessToken"
[Asserts]
jsonpath "$.data.selectInstitute.accessToken" != null

# Step 3: Create a new institute (will start as PENDING with setupStatus != COMPLETED)
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation CreateInstitute($input: CreateInstituteInput!) { createInstitute(input: $input) { id status setupStatus } }",
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
new_institute_id: jsonpath "$.data.createInstitute.id"
[Asserts]
jsonpath "$.data.createInstitute.id" != null
jsonpath "$.data.createInstitute.status" == "PENDING"

# Step 4: Try to activateInstitute on a PENDING institute with setupStatus != COMPLETED
# → Must return an error (setup not complete)
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation Activate($id: ID!) { activateInstitute(id: $id) { id status setupStatus } }",
  "variables": { "id": "{{new_institute_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.errors" count >= 1
jsonpath "$.data" == null

# Step 5: Reject the PENDING institute → status should become REJECTED
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation Reject($id: ID!) { rejectInstitute(id: $id) { id status setupStatus } }",
  "variables": { "id": "{{new_institute_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.rejectInstitute.id" == {{new_institute_id}}
jsonpath "$.data.rejectInstitute.status" == "REJECTED"

# Step 6: Try to activate a REJECTED institute → must fail (terminal state, no transitions out)
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation Activate($id: ID!) { activateInstitute(id: $id) { id status setupStatus } }",
  "variables": { "id": "{{new_institute_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.errors" count >= 1
jsonpath "$.errors[0].message" contains "Cannot transition from REJECTED to ACTIVE"
jsonpath "$.data" == null

# Step 7: Deactivate the seed institute (ACTIVE → INACTIVE)
# institute_1_id is the seed institute: ACTIVE + setupStatus==COMPLETED
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation Deactivate($id: ID!) { deactivateInstitute(id: $id) { id status setupStatus } }",
  "variables": { "id": "{{institute_1_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.deactivateInstitute.id" == {{institute_1_id}}
jsonpath "$.data.deactivateInstitute.status" == "INACTIVE"

# Step 8: Re-activate the seed institute (INACTIVE → ACTIVE)
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation Activate($id: ID!) { activateInstitute(id: $id) { id status setupStatus } }",
  "variables": { "id": "{{institute_1_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.activateInstitute.id" == {{institute_1_id}}
jsonpath "$.data.activateInstitute.status" == "ACTIVE"

# Step 9: Suspend the seed institute (ACTIVE → SUSPENDED)
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation Suspend($id: ID!) { suspendInstitute(id: $id) { id status setupStatus } }",
  "variables": { "id": "{{institute_1_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.suspendInstitute.id" == {{institute_1_id}}
jsonpath "$.data.suspendInstitute.status" == "SUSPENDED"

# Step 10: Resume the seed institute from SUSPENDED (SUSPENDED → ACTIVE)
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation Activate($id: ID!) { activateInstitute(id: $id) { id status setupStatus } }",
  "variables": { "id": "{{institute_1_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.activateInstitute.id" == {{institute_1_id}}
jsonpath "$.data.activateInstitute.status" == "ACTIVE"
jsonpath "$.data.activateInstitute.setupStatus" == "COMPLETED"
