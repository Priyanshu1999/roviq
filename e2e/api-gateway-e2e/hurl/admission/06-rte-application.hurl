# ============================================================
# RTE Application — flag preserved through workflow
# ============================================================

POST {{base_url}}/graphql
Content-Type: application/json
{
  "query": "mutation { instituteLogin(username: \"{{username}}\", password: \"{{password}}\") { accessToken } }"
}
HTTP 200
[Captures]
access_token: jsonpath "$.data.instituteLogin.accessToken"

POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation { selectInstitute(membershipId: \"{{admin_membership_id}}\") { accessToken } }"
}
HTTP 200
[Captures]
inst_token: jsonpath "$.data.selectInstitute.accessToken"

POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "query { standards { id } }"
}
HTTP 200
[Captures]
standard_id: jsonpath "$.data.standards[0].id"

# Create RTE application
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "mutation($input: CreateApplicationInput!) { createApplication(input: $input) { id status isRteApplication } }",
  "variables": {
    "input": {
      "academicYearId": "{{academic_year_id}}",
      "standardId": "{{standard_id}}",
      "formData": { "studentName": "RTE Student", "parentPhone": "9111222333" },
      "isRteApplication": true
    }
  }
}
HTTP 200
[Captures]
rte_app_id: jsonpath "$.data.createApplication.id"
[Asserts]
jsonpath "$.data.createApplication.isRteApplication" == true
jsonpath "$.data.createApplication.status" == "submitted"

# Verify RTE flag preserved after status change
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "mutation($id: ID!, $input: UpdateApplicationInput!) { updateApplication(id: $id, input: $input) { id status isRteApplication } }",
  "variables": { "id": "{{rte_app_id}}", "input": { "status": "documents_pending" } }
}
HTTP 200
[Asserts]
jsonpath "$.data.updateApplication.isRteApplication" == true
jsonpath "$.data.updateApplication.status" == "documents_pending"
