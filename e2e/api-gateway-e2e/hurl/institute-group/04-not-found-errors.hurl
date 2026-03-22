# ============================================================
# Institute Group — Not Found Error Handling
# Tests: get and delete with non-existent IDs
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

# Step 3: Get a non-existent group by ID — expect errors
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "query GetInstituteGroup($id: ID!) { instituteGroup(id: $id) { id name code type status } }",
  "variables": { "id": "00000000-0000-0000-0000-000000000000" }
}
HTTP 200
[Asserts]
jsonpath "$.errors" count >= 1

# Step 4: Delete a non-existent group — expect errors
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation DeleteInstituteGroup($id: ID!) { deleteInstituteGroup(id: $id) }",
  "variables": { "id": "00000000-0000-0000-0000-000000000000" }
}
HTTP 200
[Asserts]
jsonpath "$.errors" count >= 1
