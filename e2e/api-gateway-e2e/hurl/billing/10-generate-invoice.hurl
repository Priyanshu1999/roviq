# ============================================================
# Generate Invoice for Subscription
# Reseller creates a plan, assigns it, then generates an invoice.
# ============================================================

# Step 1: Reseller login
POST {{base_url}}/graphql
Content-Type: application/json
{
  "query": "mutation { resellerLogin(username: \"{{reseller_username}}\", password: \"{{reseller_password}}\") { accessToken } }"
}
HTTP 200
[Captures]
access_token: jsonpath "$.data.resellerLogin.accessToken"
[Asserts]
jsonpath "$.data.resellerLogin.accessToken" != null

# Step 2: Create a free plan for invoice test
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation CreatePlan($input: CreatePlanInput!) { createSubscriptionPlan(input: $input) { id } }",
  "variables": {
    "input": {
      "name": {"en": "Hurl Invoice Test Plan"},
      "amount": "50000",
      "currency": "INR",
      "interval": "MONTHLY",
      "entitlements": { "maxStudents": 10, "maxStaff": 5, "maxStorageMb": 1024, "auditLogRetentionDays": 30, "features": [] },
      "resellerId": "{{reseller_id}}",
      "code": "HURL-INV-10"
    }
  }
}
HTTP 200
[Captures]
plan_id: jsonpath "$.data.createSubscriptionPlan.id"

# Step 3: Assign to institute (needs cancel existing first)
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation AssignPlan($tenantId: ID!, $planId: ID!) { assignPlanToInstitute(tenantId: $tenantId, planId: $planId) { id status } }",
  "variables": { "tenantId": "{{institute_1_id}}", "planId": "{{plan_id}}" }
}
HTTP 200
[Captures]
sub_id: jsonpath "$.data.assignPlanToInstitute.id"

# Step 4: Generate invoice
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation GenerateInvoice($input: GenerateInvoiceInput!) { generateInvoice(input: $input) { id invoiceNumber totalAmount status } }",
  "variables": {
    "input": { "tenantId": "{{institute_1_id}}", "subscriptionId": "{{sub_id}}" }
  }
}
HTTP 200
[Asserts]
jsonpath "$.data.generateInvoice.id" != null
jsonpath "$.data.generateInvoice.invoiceNumber" != null
jsonpath "$.data.generateInvoice.status" == "SENT"
