# ============================================================
# Application Lifecycle — walk through the full pipeline
# submitted → documents_pending → documents_verified → offer_made → offer_accepted → fee_pending → fee_paid → enrolled
# ============================================================
# Auth: inst_token injected by auth-setup.sh

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
  "variables": { "id": "{{app_id}}", "input": { "status": "DOCUMENTS_PENDING" } }
}
HTTP 200
[Asserts]
jsonpath "$.data.updateApplication.status" == "DOCUMENTS_PENDING"

# documents_pending → documents_verified
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "mutation($id: ID!, $input: UpdateApplicationInput!) { updateApplication(id: $id, input: $input) { id status } }",
  "variables": { "id": "{{app_id}}", "input": { "status": "DOCUMENTS_VERIFIED" } }
}
HTTP 200
[Asserts]
jsonpath "$.data.updateApplication.status" == "DOCUMENTS_VERIFIED"

# documents_verified → offer_made
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "mutation($id: ID!, $input: UpdateApplicationInput!) { updateApplication(id: $id, input: $input) { id status offeredAt } }",
  "variables": { "id": "{{app_id}}", "input": { "status": "OFFER_MADE" } }
}
HTTP 200
[Asserts]
jsonpath "$.data.updateApplication.status" == "OFFER_MADE"
jsonpath "$.data.updateApplication.offeredAt" != null

# offer_made → offer_accepted
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "mutation($id: ID!, $input: UpdateApplicationInput!) { updateApplication(id: $id, input: $input) { id status offerAcceptedAt } }",
  "variables": { "id": "{{app_id}}", "input": { "status": "OFFER_ACCEPTED" } }
}
HTTP 200
[Asserts]
jsonpath "$.data.updateApplication.status" == "OFFER_ACCEPTED"

# offer_accepted → fee_pending
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "mutation($id: ID!, $input: UpdateApplicationInput!) { updateApplication(id: $id, input: $input) { id status } }",
  "variables": { "id": "{{app_id}}", "input": { "status": "FEE_PENDING" } }
}
HTTP 200
[Asserts]
jsonpath "$.data.updateApplication.status" == "FEE_PENDING"

# fee_pending → fee_paid
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "mutation($id: ID!, $input: UpdateApplicationInput!) { updateApplication(id: $id, input: $input) { id status } }",
  "variables": { "id": "{{app_id}}", "input": { "status": "FEE_PAID" } }
}
HTTP 200
[Asserts]
jsonpath "$.data.updateApplication.status" == "FEE_PAID"

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
jsonpath "$.data.approveApplication.status" == "ENROLLED"
