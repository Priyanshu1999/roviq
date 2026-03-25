# Auth: admin_token injected by auth-setup.sh
# ============================================================
# Admin Get Institute — single-fetch queries
# Tests: adminGetInstitute(id) and not-found error
# ============================================================

# Step 1: Get institute by known seed ID
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
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

# Step 2: Get non-existent institute — expect GraphQL errors
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "query AdminGetInstitute($id: ID!) { adminGetInstitute(id: $id) { id name } }",
  "variables": { "id": "00000000-0000-0000-0000-000000000000" }
}
HTTP 200
[Asserts]
jsonpath "$.errors" not isEmpty
