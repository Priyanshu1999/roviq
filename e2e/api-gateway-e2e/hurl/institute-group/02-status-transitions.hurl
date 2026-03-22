# ============================================================
# Institute Group Status Transitions
# Tests: deactivate, activate, suspend, and re-activate flows
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

# Step 2: Select institute -> get accessToken
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

# Step 3: Create an institute group for status testing
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation CreateInstituteGroup($input: CreateInstituteGroupInput!) { createInstituteGroup(input: $input) { id name code type status } }",
  "variables": {
    "input": {
      "name": "Chain Status Test",
      "code": "chain-status-e2e",
      "type": "CHAIN"
    }
  }
}
HTTP 200
[Captures]
group_id: jsonpath "$.data.createInstituteGroup.id"
[Asserts]
jsonpath "$.data.createInstituteGroup.id" != null
jsonpath "$.data.createInstituteGroup.status" == "ACTIVE"

# Step 4: Deactivate the group (ACTIVE -> INACTIVE)
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation DeactivateInstituteGroup($id: ID!) { deactivateInstituteGroup(id: $id) { id status } }",
  "variables": { "id": "{{group_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.deactivateInstituteGroup.id" == {{group_id}}
jsonpath "$.data.deactivateInstituteGroup.status" == "INACTIVE"

# Step 5: Activate the group (INACTIVE -> ACTIVE)
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation ActivateInstituteGroup($id: ID!) { activateInstituteGroup(id: $id) { id status } }",
  "variables": { "id": "{{group_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.activateInstituteGroup.id" == {{group_id}}
jsonpath "$.data.activateInstituteGroup.status" == "ACTIVE"

# Step 6: Suspend the group (ACTIVE -> SUSPENDED)
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation SuspendInstituteGroup($id: ID!) { suspendInstituteGroup(id: $id) { id status } }",
  "variables": { "id": "{{group_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.suspendInstituteGroup.id" == {{group_id}}
jsonpath "$.data.suspendInstituteGroup.status" == "SUSPENDED"

# Step 7: Activate from suspended (SUSPENDED -> ACTIVE)
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation ActivateInstituteGroup($id: ID!) { activateInstituteGroup(id: $id) { id status } }",
  "variables": { "id": "{{group_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.activateInstituteGroup.id" == {{group_id}}
jsonpath "$.data.activateInstituteGroup.status" == "ACTIVE"

# Step 8: Delete group (cleanup)
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation DeleteInstituteGroup($id: ID!) { deleteInstituteGroup(id: $id) }",
  "variables": { "id": "{{group_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.deleteInstituteGroup" == true
