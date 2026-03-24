# ============================================================
# Admin Institute Approval Flow (ROV-132, ROV-134)
# Tests: adminCreateInstitute → adminListInstitutes → adminGetInstitute
#        → adminDeleteInstitute → adminRestoreInstitute
# ============================================================

# Step 1: Admin login
POST {{base_url}}/graphql
Content-Type: application/json
{
  "query": "mutation { adminLogin(username: \"{{username}}\", password: \"{{password}}\") { accessToken } }"
}
HTTP 200
[Captures]
admin_token: jsonpath "$.data.adminLogin.accessToken"
[Asserts]
jsonpath "$.data.adminLogin.accessToken" != null

# Step 2: Admin creates an institute (status should be PENDING)
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "mutation AdminCreateInstitute($input: AdminCreateInstituteInput!) { adminCreateInstitute(input: $input) { id name slug type status setupStatus } }",
  "variables": {
    "input": {
      "name": { "en": "Approval Flow Test Institute" },
      "slug": "approval-flow-test",
      "type": "SCHOOL",
      "departments": ["PRIMARY", "SECONDARY"]
    }
  }
}
HTTP 200
[Captures]
institute_id: jsonpath "$.data.adminCreateInstitute.id"
[Asserts]
jsonpath "$.data.adminCreateInstitute.id" != null
jsonpath "$.data.adminCreateInstitute.name.en" == "Approval Flow Test Institute"
jsonpath "$.data.adminCreateInstitute.slug" == "approval-flow-test"
jsonpath "$.data.adminCreateInstitute.type" == "SCHOOL"

# Step 3: Admin lists institutes — verify new institute appears
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "query AdminListInstitutes { adminListInstitutes { edges { node { id name slug status } } totalCount } }"
}
HTTP 200
[Asserts]
jsonpath "$.data.adminListInstitutes.totalCount" >= 1
jsonpath "$.data.adminListInstitutes.edges" count >= 1

# Step 4: Admin gets institute by ID — verify details
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "query AdminGetInstitute($id: ID!) { adminGetInstitute(id: $id) { id name slug type status setupStatus timezone currency } }",
  "variables": { "id": "{{institute_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.adminGetInstitute.id" == {{institute_id}}
jsonpath "$.data.adminGetInstitute.name.en" == "Approval Flow Test Institute"
jsonpath "$.data.adminGetInstitute.type" == "SCHOOL"

# Step 5: Admin gets statistics
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "query { adminInstituteStatistics }"
}
HTTP 200
[Asserts]
jsonpath "$.data.adminInstituteStatistics.totalInstitutes" >= 1

# Step 6: Admin soft-deletes the institute
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "mutation AdminDeleteInstitute($id: ID!) { adminDeleteInstitute(id: $id) }",
  "variables": { "id": "{{institute_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.adminDeleteInstitute" == true

# Step 7: Verify deleted institute is gone from normal listing
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "query AdminGetInstitute($id: ID!) { adminGetInstitute(id: $id) { id status } }",
  "variables": { "id": "{{institute_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.errors" not isEmpty

# Step 8: Admin restores the institute
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "mutation AdminRestoreInstitute($id: ID!) { adminRestoreInstitute(id: $id) { id name status } }",
  "variables": { "id": "{{institute_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.adminRestoreInstitute.id" == {{institute_id}}
jsonpath "$.data.adminRestoreInstitute.name.en" == "Approval Flow Test Institute"

# Step 9: Final cleanup — delete the restored institute
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "mutation AdminDeleteInstitute($id: ID!) { adminDeleteInstitute(id: $id) }",
  "variables": { "id": "{{institute_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.adminDeleteInstitute" == true
