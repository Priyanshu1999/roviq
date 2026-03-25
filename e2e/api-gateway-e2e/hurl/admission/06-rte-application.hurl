# ============================================================
# RTE Application — flag preserved through workflow
# ============================================================
# Auth: inst_token injected by auth-setup.sh

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
