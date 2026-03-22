# ============================================================
# Institute Group CRUD Lifecycle
# Tests: create, get, update, list, filter, delete
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

# Step 3: Create an institute group
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation CreateInstituteGroup($input: CreateInstituteGroupInput!) { createInstituteGroup(input: $input) { id name code type status registrationNo registrationState contact address createdById createdAt updatedAt } }",
  "variables": {
    "input": {
      "name": "Test Trust",
      "code": "test-trust-e2e",
      "type": "TRUST"
    }
  }
}
HTTP 200
[Captures]
group_id: jsonpath "$.data.createInstituteGroup.id"
[Asserts]
jsonpath "$.data.createInstituteGroup.id" != null
jsonpath "$.data.createInstituteGroup.name" == "Test Trust"
jsonpath "$.data.createInstituteGroup.code" == "test-trust-e2e"
jsonpath "$.data.createInstituteGroup.type" == "TRUST"
jsonpath "$.data.createInstituteGroup.status" == "ACTIVE"
jsonpath "$.data.createInstituteGroup.createdAt" != null
jsonpath "$.data.createInstituteGroup.updatedAt" != null

# Step 4: Get the created group by id
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "query GetInstituteGroup($id: ID!) { instituteGroup(id: $id) { id name code type status registrationNo registrationState contact address createdById createdAt updatedAt } }",
  "variables": { "id": "{{group_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.instituteGroup.id" == {{group_id}}
jsonpath "$.data.instituteGroup.name" == "Test Trust"
jsonpath "$.data.instituteGroup.code" == "test-trust-e2e"
jsonpath "$.data.instituteGroup.type" == "TRUST"
jsonpath "$.data.instituteGroup.status" == "ACTIVE"

# Step 5: Update the group
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation UpdateInstituteGroup($id: ID!, $input: UpdateInstituteGroupInput!) { updateInstituteGroup(id: $id, input: $input) { id name code type status registrationNo registrationState } }",
  "variables": {
    "id": "{{group_id}}",
    "input": {
      "name": "Updated Trust",
      "registrationNo": "REG-2026-001"
    }
  }
}
HTTP 200
[Asserts]
jsonpath "$.data.updateInstituteGroup.id" == {{group_id}}
jsonpath "$.data.updateInstituteGroup.name" == "Updated Trust"
jsonpath "$.data.updateInstituteGroup.registrationNo" == "REG-2026-001"
jsonpath "$.data.updateInstituteGroup.code" == "test-trust-e2e"
jsonpath "$.data.updateInstituteGroup.type" == "TRUST"

# Step 6: List institute groups (no filter)
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "query ListInstituteGroups { instituteGroups { edges { node { id name code type status } cursor } pageInfo { hasNextPage hasPreviousPage startCursor endCursor } totalCount } }"
}
HTTP 200
[Asserts]
jsonpath "$.data.instituteGroups.edges" count >= 1
jsonpath "$.data.instituteGroups.totalCount" >= 1
jsonpath "$.data.instituteGroups.pageInfo.hasNextPage" isBoolean
jsonpath "$.data.instituteGroups.edges[0].node.id" != null
jsonpath "$.data.instituteGroups.edges[0].cursor" != null

# Step 7: List with search filter matching "test-trust"
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "query ListInstituteGroups($filter: InstituteGroupFilterInput) { instituteGroups(filter: $filter) { edges { node { id name code } } totalCount } }",
  "variables": { "filter": { "search": "test-trust" } }
}
HTTP 200
[Asserts]
jsonpath "$.data.instituteGroups.totalCount" >= 1

# Step 8: Delete the group
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
