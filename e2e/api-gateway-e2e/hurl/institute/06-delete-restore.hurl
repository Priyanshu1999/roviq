# ============================================================
# Institute Soft Delete and Restore
# Tests: deleteInstitute mutation, soft-delete visibility,
#        restoreInstitute mutation, and not-found error handling
# ============================================================

# Step 1: Institute login (multi-institute admin)
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

# Step 2: Select institute → get accessToken
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

# Step 3: Create a fresh institute to be deleted
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation CreateInstitute($input: CreateInstituteInput!) { createInstitute(input: $input) { id name slug status } }",
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
delete_institute_id: jsonpath "$.data.createInstitute.id"
[Asserts]
jsonpath "$.data.createInstitute.id" != null
jsonpath "$.data.createInstitute.name.en" == "Hurl Delete Test"
jsonpath "$.data.createInstitute.slug" == "hurl-delete-test"

# Step 4: Delete the institute — expect true
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation DeleteInstitute($id: ID!) { deleteInstitute(id: $id) }",
  "variables": { "id": "{{delete_institute_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.deleteInstitute" == true

# Step 5: Attempt to fetch the soft-deleted institute — expect errors
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "query GetInstitute($id: ID!) { institute(id: $id) { id name slug status } }",
  "variables": { "id": "{{delete_institute_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.errors" count >= 1

# Step 6: Restore the institute — expect id and non-null status
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation RestoreInstitute($id: ID!) { restoreInstitute(id: $id) { id name slug status } }",
  "variables": { "id": "{{delete_institute_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.restoreInstitute.id" == {{delete_institute_id}}
jsonpath "$.data.restoreInstitute.status" != null

# Step 7: Verify restored institute is accessible
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "query GetInstitute($id: ID!) { institute(id: $id) { id name slug status } }",
  "variables": { "id": "{{delete_institute_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.institute.id" == {{delete_institute_id}}
jsonpath "$.data.institute.name.en" == "Hurl Delete Test"

# Step 8: Attempt to delete a non-existent institute — expect errors
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation DeleteInstitute($id: ID!) { deleteInstitute(id: $id) }",
  "variables": { "id": "00000000-0000-0000-0000-000000000000" }
}
HTTP 200
[Asserts]
jsonpath "$.errors" count >= 1
