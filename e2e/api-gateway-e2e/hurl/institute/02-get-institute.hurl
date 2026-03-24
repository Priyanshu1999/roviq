# ============================================================
# Admin Get Institute — single-fetch queries
# Tests: adminGetInstitute(id) and not-found error
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

# Step 2: Get institute by known seed ID
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "query AdminGetInstitute($id: ID!) { adminGetInstitute(id: $id) { id name slug type status setupStatus timezone currency contact } }",
  "variables": { "id": "{{institute_1_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.adminGetInstitute.id" == "{{institute_1_id}}"
jsonpath "$.data.adminGetInstitute.name" != null
jsonpath "$.data.adminGetInstitute.slug" != null
jsonpath "$.data.adminGetInstitute.type" != null
jsonpath "$.data.adminGetInstitute.status" != null
jsonpath "$.data.adminGetInstitute.setupStatus" != null
jsonpath "$.data.adminGetInstitute.timezone" != null
jsonpath "$.data.adminGetInstitute.currency" != null
jsonpath "$.data.adminGetInstitute.contact" != null

# Step 3: Get non-existent institute — expect GraphQL errors
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "query AdminGetInstitute($id: ID!) { adminGetInstitute(id: $id) { id name } }",
  "variables": { "id": "00000000-0000-0000-0000-000000000000" }
}
HTTP 200
[Asserts]
jsonpath "$.errors" not isEmpty
