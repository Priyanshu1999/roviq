# Auth: admin_token injected by auth-setup.sh
# ============================================================
# Admin Institute Soft Delete and Restore
# Tests: adminDeleteInstitute, adminGetInstitute (verify gone),
#        adminRestoreInstitute, and not-found error handling
# ============================================================

# Step 1: Create a fresh institute to be deleted
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
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

# Step 2: Delete the institute — expect true
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "mutation AdminDeleteInstitute($id: ID!) { adminDeleteInstitute(id: $id) }",
  "variables": { "id": "{{delete_institute_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.adminDeleteInstitute" == true

# Step 3: Attempt to fetch the soft-deleted institute — expect errors
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "query AdminGetInstitute($id: ID!) { adminGetInstitute(id: $id) { id name slug status } }",
  "variables": { "id": "{{delete_institute_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.errors" count >= 1

# Step 4: Restore the institute
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "mutation AdminRestoreInstitute($id: ID!) { adminRestoreInstitute(id: $id) { id name status } }",
  "variables": { "id": "{{delete_institute_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.adminRestoreInstitute.id" == {{delete_institute_id}}
jsonpath "$.data.adminRestoreInstitute.status" != null

# Step 5: Verify restored institute is accessible
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "query AdminGetInstitute($id: ID!) { adminGetInstitute(id: $id) { id name slug status } }",
  "variables": { "id": "{{delete_institute_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.adminGetInstitute.id" == {{delete_institute_id}}
jsonpath "$.data.adminGetInstitute.name.en" == "Hurl Delete Test"

# Step 6: Attempt to delete a non-existent institute — expect errors
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "mutation AdminDeleteInstitute($id: ID!) { adminDeleteInstitute(id: $id) }",
  "variables": { "id": "00000000-0000-0000-0000-000000000000" }
}
HTTP 200
[Asserts]
jsonpath "$.errors" count >= 1

# Step 7: Final cleanup — delete the test institute
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "mutation AdminDeleteInstitute($id: ID!) { adminDeleteInstitute(id: $id) }",
  "variables": { "id": "{{delete_institute_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.adminDeleteInstitute" == true
