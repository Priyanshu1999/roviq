# Auth: admin_token injected by auth-setup.sh
# ============================================================
# Admin Institute Group CRUD via Platform Scope
# Tests: adminCreateInstituteGroup, adminListInstituteGroups,
#        adminUpdateInstituteGroup, adminDeleteInstituteGroup
#
# These are the platform-scoped (admin) counterparts to the
# institute-scoped group resolvers tested in institute-group/.
#
# Variables required: base_url, admin_token
# ============================================================

# Step 1: Create an institute group with all fields
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "mutation AdminCreateInstituteGroup($input: CreateInstituteGroupInput!) { adminCreateInstituteGroup(input: $input) { id name code type status registrationNumber createdAt updatedAt } }",
  "variables": {
    "input": {
      "name": "E2E Admin Test Trust",
      "code": "e2e-admin-test-trust",
      "type": "TRUST",
      "registrationNumber": "REG-E2E-ADMIN-001"
    }
  }
}
HTTP 200
[Captures]
group_id: jsonpath "$.data.adminCreateInstituteGroup.id"
[Asserts]
jsonpath "$.data.adminCreateInstituteGroup.id" != null
jsonpath "$.data.adminCreateInstituteGroup.name" == "E2E Admin Test Trust"
jsonpath "$.data.adminCreateInstituteGroup.code" == "e2e-admin-test-trust"
jsonpath "$.data.adminCreateInstituteGroup.type" == "TRUST"
jsonpath "$.data.adminCreateInstituteGroup.status" == "ACTIVE"
jsonpath "$.data.adminCreateInstituteGroup.registrationNumber" == "REG-E2E-ADMIN-001"
jsonpath "$.data.adminCreateInstituteGroup.createdAt" != null
jsonpath "$.data.adminCreateInstituteGroup.updatedAt" != null

# Step 2: List institute groups — verify our group appears
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "query { adminListInstituteGroups { edges { node { id name code type status } cursor } pageInfo { hasNextPage hasPreviousPage startCursor endCursor } totalCount } }"
}
HTTP 200
[Asserts]
jsonpath "$.data.adminListInstituteGroups.totalCount" >= 1
jsonpath "$.data.adminListInstituteGroups.edges" count >= 1
jsonpath "$.data.adminListInstituteGroups.pageInfo.hasNextPage" isBoolean
jsonpath "$.data.adminListInstituteGroups.edges[0].node.id" != null
jsonpath "$.data.adminListInstituteGroups.edges[0].cursor" != null

# Step 3: Update the group name and registration number
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "mutation AdminUpdateInstituteGroup($id: ID!, $input: UpdateInstituteGroupInput!) { adminUpdateInstituteGroup(id: $id, input: $input) { id name code type status registrationNumber } }",
  "variables": {
    "id": "{{group_id}}",
    "input": {
      "version": 1,
      "name": "Updated E2E Admin Trust",
      "registrationNumber": "REG-E2E-ADMIN-002"
    }
  }
}
HTTP 200
[Asserts]
jsonpath "$.data.adminUpdateInstituteGroup.id" == {{group_id}}
jsonpath "$.data.adminUpdateInstituteGroup.name" == "Updated E2E Admin Trust"
jsonpath "$.data.adminUpdateInstituteGroup.registrationNumber" == "REG-E2E-ADMIN-002"
jsonpath "$.data.adminUpdateInstituteGroup.code" == "e2e-admin-test-trust"
jsonpath "$.data.adminUpdateInstituteGroup.type" == "TRUST"
jsonpath "$.data.adminUpdateInstituteGroup.status" == "ACTIVE"

# Step 4: List with search filter to verify the update
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "query AdminListInstituteGroups($filter: InstituteGroupFilterInput) { adminListInstituteGroups(filter: $filter) { edges { node { id name code } } totalCount } }",
  "variables": { "filter": { "search": "e2e-admin-test-trust" } }
}
HTTP 200
[Asserts]
jsonpath "$.data.adminListInstituteGroups.totalCount" >= 1

# Step 5: Delete the group
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "mutation AdminDeleteInstituteGroup($id: ID!) { adminDeleteInstituteGroup(id: $id) }",
  "variables": { "id": "{{group_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.adminDeleteInstituteGroup" == true

# Step 6: Verify deleted group is not in listing
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "query AdminListInstituteGroups($filter: InstituteGroupFilterInput) { adminListInstituteGroups(filter: $filter) { edges { node { id name } } totalCount } }",
  "variables": { "filter": { "search": "e2e-admin-test-trust" } }
}
HTTP 200
[Asserts]
jsonpath "$.data.adminListInstituteGroups.totalCount" == 0
