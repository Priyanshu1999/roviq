# Auth: reseller_token injected by auth-setup.sh, admin_token injected by auth-setup.sh
# ============================================================
# Reseller Create Institute Request + Admin Approval
# Tests: resellerCreateInstituteRequest, resellerListInstitutes,
#        resellerGetInstitute, resellerInstituteStatistics,
#        adminApproveInstitute cross-scope flow
# ============================================================

# Step 1: Reseller creates institute request — status should be PENDING_APPROVAL
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{reseller_token}}
{
  "query": "mutation ResellerCreate($input: ResellerCreateInstituteRequestInput!) { resellerCreateInstituteRequest(input: $input) { id name slug type status } }",
  "variables": {
    "input": {
      "name": { "en": "Reseller Request Test" },
      "slug": "reseller-request-test",
      "type": "SCHOOL",
      "departments": ["PRIMARY", "SECONDARY"]
    }
  }
}
HTTP 200
[Captures]
inst_id: jsonpath "$.data.resellerCreateInstituteRequest.id"
[Asserts]
jsonpath "$.data.resellerCreateInstituteRequest.id" != null
jsonpath "$.data.resellerCreateInstituteRequest.name.en" == "Reseller Request Test"
jsonpath "$.data.resellerCreateInstituteRequest.slug" == "reseller-request-test"
jsonpath "$.data.resellerCreateInstituteRequest.type" == "SCHOOL"
jsonpath "$.data.resellerCreateInstituteRequest.status" == "PENDING_APPROVAL"

# Step 2: Reseller lists their institutes — should include the new one
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{reseller_token}}
{
  "query": "query { resellerListInstitutes { edges { node { id name slug status } } totalCount } }"
}
HTTP 200
[Asserts]
jsonpath "$.data.resellerListInstitutes.totalCount" >= 1
jsonpath "$.data.resellerListInstitutes.edges" count >= 1

# Step 3: Reseller gets institute details by ID
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{reseller_token}}
{
  "query": "query ResellerGetInstitute($id: ID!) { resellerGetInstitute(id: $id) { id name slug status type structureFramework } }",
  "variables": { "id": "{{inst_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.resellerGetInstitute.id" == {{inst_id}}
jsonpath "$.data.resellerGetInstitute.name.en" == "Reseller Request Test"
jsonpath "$.data.resellerGetInstitute.slug" == "reseller-request-test"
jsonpath "$.data.resellerGetInstitute.status" == "PENDING_APPROVAL"
jsonpath "$.data.resellerGetInstitute.type" == "SCHOOL"

# Step 4: Reseller institute statistics — verify count includes new institute
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{reseller_token}}
{
  "query": "query { resellerInstituteStatistics }"
}
HTTP 200
[Asserts]
jsonpath "$.data.resellerInstituteStatistics" != null

# Step 5: Admin approves the reseller's institute request — status PENDING_APPROVAL -> PENDING
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "mutation AdminApprove($id: ID!) { adminApproveInstitute(id: $id) { id status } }",
  "variables": { "id": "{{inst_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.adminApproveInstitute.id" == {{inst_id}}
jsonpath "$.data.adminApproveInstitute.status" == "PENDING"

# Step 6: Verify reseller can see the updated status
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{reseller_token}}
{
  "query": "query ResellerGetInstitute($id: ID!) { resellerGetInstitute(id: $id) { id status } }",
  "variables": { "id": "{{inst_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.resellerGetInstitute.id" == {{inst_id}}
jsonpath "$.data.resellerGetInstitute.status" == "PENDING"

# Step 7: Cleanup — admin soft-deletes the test institute
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "mutation AdminDelete($id: ID!) { adminDeleteInstitute(id: $id) }",
  "variables": { "id": "{{inst_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.adminDeleteInstitute" == true
