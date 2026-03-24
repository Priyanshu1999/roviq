# ============================================================
# Admin Institute Group CRUD Lifecycle
# Tests: adminCreateInstituteGroup, adminListInstituteGroups,
#        adminUpdateInstituteGroup, adminDeleteInstituteGroup
# ============================================================

# Step 1: Admin login (platform scope — returns accessToken directly)
POST {{base_url}}/graphql
Content-Type: application/json
{
  "query": "mutation { adminLogin(username: \"{{username}}\", password: \"{{password}}\") { accessToken } }"
}
HTTP 200
[Captures]
access_token: jsonpath "$.data.adminLogin.accessToken"
[Asserts]
jsonpath "$.data.adminLogin.accessToken" != null

# Step 2: Create an institute group
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation AdminCreateInstituteGroup($input: CreateInstituteGroupInput!) { adminCreateInstituteGroup(input: $input) { id name code type status registrationNumber createdAt updatedAt } }",
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
group_id: jsonpath "$.data.adminCreateInstituteGroup.id"
[Asserts]
jsonpath "$.data.adminCreateInstituteGroup.id" != null
jsonpath "$.data.adminCreateInstituteGroup.name" == "Test Trust"
jsonpath "$.data.adminCreateInstituteGroup.code" == "test-trust-e2e"
jsonpath "$.data.adminCreateInstituteGroup.type" == "TRUST"
jsonpath "$.data.adminCreateInstituteGroup.status" == "ACTIVE"
jsonpath "$.data.adminCreateInstituteGroup.createdAt" != null
jsonpath "$.data.adminCreateInstituteGroup.updatedAt" != null

# Step 3: Update the group
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation AdminUpdateInstituteGroup($id: ID!, $input: UpdateInstituteGroupInput!) { adminUpdateInstituteGroup(id: $id, input: $input) { id name code type status registrationNumber } }",
  "variables": {
    "id": "{{group_id}}",
    "input": {
      "version": 1,
      "name": "Updated Trust",
      "registrationNumber": "REG-2026-001"
    }
  }
}
HTTP 200
[Asserts]
jsonpath "$.data.adminUpdateInstituteGroup.id" == {{group_id}}
jsonpath "$.data.adminUpdateInstituteGroup.name" == "Updated Trust"
jsonpath "$.data.adminUpdateInstituteGroup.registrationNumber" == "REG-2026-001"
jsonpath "$.data.adminUpdateInstituteGroup.code" == "test-trust-e2e"
jsonpath "$.data.adminUpdateInstituteGroup.type" == "TRUST"

# Step 4: List institute groups (no filter)
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "query AdminListInstituteGroups { adminListInstituteGroups { edges { node { id name code type status } cursor } pageInfo { hasNextPage hasPreviousPage startCursor endCursor } totalCount } }"
}
HTTP 200
[Asserts]
jsonpath "$.data.adminListInstituteGroups.edges" count >= 1
jsonpath "$.data.adminListInstituteGroups.totalCount" >= 1
jsonpath "$.data.adminListInstituteGroups.pageInfo.hasNextPage" isBoolean
jsonpath "$.data.adminListInstituteGroups.edges[0].node.id" != null
jsonpath "$.data.adminListInstituteGroups.edges[0].cursor" != null

# Step 5: List with search filter matching "test-trust"
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "query AdminListInstituteGroups($filter: InstituteGroupFilterInput) { adminListInstituteGroups(filter: $filter) { edges { node { id name code } } totalCount } }",
  "variables": { "filter": { "search": "test-trust" } }
}
HTTP 200
[Asserts]
jsonpath "$.data.adminListInstituteGroups.totalCount" >= 1

# Step 6: Delete the group
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation AdminDeleteInstituteGroup($id: ID!) { adminDeleteInstituteGroup(id: $id) }",
  "variables": { "id": "{{group_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.adminDeleteInstituteGroup" == true
