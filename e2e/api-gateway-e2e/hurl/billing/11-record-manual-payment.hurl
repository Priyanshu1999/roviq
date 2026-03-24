# ============================================================
# Record Manual Payment
# Reseller records a cash payment for an invoice.
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

# Step 2: Create plan + assign + generate invoice
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation CreatePlan($input: CreatePlanInput!) { createSubscriptionPlan(input: $input) { id } }",
  "variables": {
    "input": {
      "name": {"en": "Hurl Payment Plan"},
      "amount": "100000",
      "currency": "INR",
      "interval": "MONTHLY",
      "entitlements": { "maxStudents": 10, "maxStaff": 5, "maxStorageMb": 1024, "auditLogRetentionDays": 30, "features": [] },
      "resellerId": "{{reseller_id}}",
      "code": "HURL-PAY-11"
    }
  }
}
HTTP 200
[Captures]
plan_id: jsonpath "$.data.createSubscriptionPlan.id"

POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation AssignPlan($tenantId: ID!, $planId: ID!) { assignPlanToInstitute(tenantId: $tenantId, planId: $planId) { id } }",
  "variables": { "tenantId": "{{institute_2_id}}", "planId": "{{plan_id}}" }
}
HTTP 200
[Captures]
sub_id: jsonpath "$.data.assignPlanToInstitute.id"

POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation GenerateInvoice($input: GenerateInvoiceInput!) { generateInvoice(input: $input) { id totalAmount } }",
  "variables": { "input": { "tenantId": "{{institute_2_id}}", "subscriptionId": "{{sub_id}}" } }
}
HTTP 200
[Captures]
invoice_id: jsonpath "$.data.generateInvoice.id"
total_amount: jsonpath "$.data.generateInvoice.totalAmount"

# Step 3: Record manual payment
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation RecordPayment($invoiceId: ID!, $input: ManualPaymentInput!) { recordManualPayment(invoiceId: $invoiceId, input: $input) { id status } }",
  "variables": {
    "invoiceId": "{{invoice_id}}",
    "input": {
      "method": "CASH",
      "amountPaise": "{{total_amount}}",
      "receiptNumber": "HURL-REC-001",
      "notes": "Test payment via Hurl"
    }
  }
}
HTTP 200
[Asserts]
jsonpath "$.data.recordManualPayment" != null
