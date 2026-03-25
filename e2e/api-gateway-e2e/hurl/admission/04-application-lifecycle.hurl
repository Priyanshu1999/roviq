# ============================================================
# Application Lifecycle — walk through the full pipeline
# submitted → documents_pending → documents_verified → offer_made → offer_accepted → fee_pending → fee_paid → enrolled
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

# Get standard
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "query { standards { id } }"
}
HTTP 200
[Captures]
standard_id: jsonpath "$.data.standards[0].id"

# Create application directly
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "mutation($input: CreateApplicationInput!) { createApplication(input: $input) { id status } }",
  "variables": {
    "input": {
      "academicYearId": "{{academic_year_id}}",
      "standardId": "{{standard_id}}",
      "formData": { "studentName": "Lifecycle Test", "parentPhone": "9999888877" }
    }
  }
}
HTTP 200
[Captures]
app_id: jsonpath "$.data.createApplication.id"
[Asserts]
jsonpath "$.data.createApplication.status" == "submitted"

# submitted → documents_pending
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "mutation($id: ID!, $input: UpdateApplicationInput!) { updateApplication(id: $id, input: $input) { id status } }",
  "variables": { "id": "{{app_id}}", "input": { "status": "documents_pending" } }
}
HTTP 200
[Asserts]
jsonpath "$.data.updateApplication.status" == "documents_pending"

# documents_pending → documents_verified
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "mutation($id: ID!, $input: UpdateApplicationInput!) { updateApplication(id: $id, input: $input) { id status } }",
  "variables": { "id": "{{app_id}}", "input": { "status": "documents_verified" } }
}
HTTP 200
[Asserts]
jsonpath "$.data.updateApplication.status" == "documents_verified"

# documents_verified → offer_made
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "mutation($id: ID!, $input: UpdateApplicationInput!) { updateApplication(id: $id, input: $input) { id status offeredAt } }",
  "variables": { "id": "{{app_id}}", "input": { "status": "offer_made" } }
}
HTTP 200
[Asserts]
jsonpath "$.data.updateApplication.status" == "offer_made"
jsonpath "$.data.updateApplication.offeredAt" != null

# offer_made → offer_accepted
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "mutation($id: ID!, $input: UpdateApplicationInput!) { updateApplication(id: $id, input: $input) { id status offerAcceptedAt } }",
  "variables": { "id": "{{app_id}}", "input": { "status": "offer_accepted" } }
}
HTTP 200
[Asserts]
jsonpath "$.data.updateApplication.status" == "offer_accepted"

# offer_accepted → fee_pending
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "mutation($id: ID!, $input: UpdateApplicationInput!) { updateApplication(id: $id, input: $input) { id status } }",
  "variables": { "id": "{{app_id}}", "input": { "status": "fee_pending" } }
}
HTTP 200
[Asserts]
jsonpath "$.data.updateApplication.status" == "fee_pending"

# fee_pending → fee_paid
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "mutation($id: ID!, $input: UpdateApplicationInput!) { updateApplication(id: $id, input: $input) { id status } }",
  "variables": { "id": "{{app_id}}", "input": { "status": "fee_paid" } }
}
HTTP 200
[Asserts]
jsonpath "$.data.updateApplication.status" == "fee_paid"

# fee_paid → enrolled (approve)
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "mutation($id: ID!) { approveApplication(id: $id) { id status } }",
  "variables": { "id": "{{app_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.approveApplication.status" == "enrolled"
