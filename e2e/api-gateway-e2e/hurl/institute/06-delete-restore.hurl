# ============================================================
# Admin Institute Soft Delete and Restore
# Tests: adminDeleteInstitute, adminGetInstitute (verify gone),
#        adminRestoreInstitute, and not-found error handling
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

# Step 2: Create a fresh institute to be deleted
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation AdminCreateInstitute($input: AdminCreateInstituteInput!) { adminCreateInstitute(input: $input) { id name slug status } }",
  "variables": {
    "input": {
      "name": { "en": "Hurl Delete Test" },
      "slug": "hurl-delete-test",
      "type": "SCHOOL"
    }
  }
}
HTTP 200
[Captures]
delete_institute_id: jsonpath "$.data.adminCreateInstitute.id"
[Asserts]
jsonpath "$.data.adminCreateInstitute.id" != null
jsonpath "$.data.adminCreateInstitute.name.en" == "Hurl Delete Test"
jsonpath "$.data.adminCreateInstitute.slug" == "hurl-delete-test"

# Step 3: Delete the institute — expect true
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation AdminDeleteInstitute($id: ID!) { adminDeleteInstitute(id: $id) }",
  "variables": { "id": "{{delete_institute_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.adminDeleteInstitute" == true

# Step 4: Attempt to fetch the soft-deleted institute — expect errors
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "query AdminGetInstitute($id: ID!) { adminGetInstitute(id: $id) { id name slug status } }",
  "variables": { "id": "{{delete_institute_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.errors" count >= 1

# Step 5: Restore the institute
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation AdminRestoreInstitute($id: ID!) { adminRestoreInstitute(id: $id) { id name status } }",
  "variables": { "id": "{{delete_institute_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.adminRestoreInstitute.id" == {{delete_institute_id}}
jsonpath "$.data.adminRestoreInstitute.status" != null

# Step 6: Verify restored institute is accessible
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "query AdminGetInstitute($id: ID!) { adminGetInstitute(id: $id) { id name slug status } }",
  "variables": { "id": "{{delete_institute_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.adminGetInstitute.id" == {{delete_institute_id}}
jsonpath "$.data.adminGetInstitute.name.en" == "Hurl Delete Test"

# Step 7: Attempt to delete a non-existent institute — expect errors
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation AdminDeleteInstitute($id: ID!) { adminDeleteInstitute(id: $id) }",
  "variables": { "id": "00000000-0000-0000-0000-000000000000" }
}
HTTP 200
[Asserts]
jsonpath "$.errors" count >= 1

# Step 8: Final cleanup — delete the test institute
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation AdminDeleteInstitute($id: ID!) { adminDeleteInstitute(id: $id) }",
  "variables": { "id": "{{delete_institute_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.adminDeleteInstitute" == true
