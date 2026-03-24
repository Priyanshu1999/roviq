# ============================================================
# Admin Institute Group — Not Found Error Handling
# Tests: admin delete with non-existent ID
#
# NOTE: adminListInstituteGroups does not have a getById query.
# The institute-scoped instituteGroup(id) requires institute scope.
# We test not-found via the admin delete mutation.
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

# Step 2: Delete a non-existent group — expect errors
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation AdminDeleteInstituteGroup($id: ID!) { adminDeleteInstituteGroup(id: $id) }",
  "variables": { "id": "00000000-0000-0000-0000-000000000000" }
}
HTTP 200
[Asserts]
jsonpath "$.errors" count >= 1
