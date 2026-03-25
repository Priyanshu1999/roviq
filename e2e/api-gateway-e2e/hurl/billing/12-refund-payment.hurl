# Auth: reseller_token injected by auth-setup.sh
# ============================================================
# Partial Refund
# Reseller issues a partial refund on a payment.
# ============================================================

# Step 1: Setup — create plan, assign, generate invoice, record payment
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{reseller_token}}
{
  "query": "mutation CreatePlan($input: CreatePlanInput!) { createSubscriptionPlan(input: $input) { id } }",
  "variables": {
    "input": {
      "name": {"en": "Hurl Refund Plan"},
      "amount": "200000",
      "currency": "INR",
      "interval": "MONTHLY",
      "entitlements": { "maxStudents": 10, "maxStaff": 5, "maxStorageMb": 1024, "auditLogRetentionDays": 30, "features": [] },
      "resellerId": "{{reseller_id}}",
      "code": "HURL-REF-12"
    }
  }
}
HTTP 200
[Captures]
plan_id: jsonpath "$.data.createSubscriptionPlan.id"

# Cancel any existing sub on institute_1
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{reseller_token}}
{
  "query": "query Sub($instituteId: ID!) { subscription(instituteId: $instituteId) { id status } }",
  "variables": { "instituteId": "{{institute_1_id}}" }
}
HTTP 200

# Assign + invoice + pay
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{reseller_token}}
{
  "query": "mutation AssignPlan($tenantId: ID!, $planId: ID!) { assignPlanToInstitute(tenantId: $tenantId, planId: $planId) { id } }",
  "variables": { "tenantId": "{{institute_1_id}}", "planId": "{{plan_id}}" }
}
HTTP 200
[Captures]
sub_id: jsonpath "$.data.assignPlanToInstitute.id"

POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{reseller_token}}
{
  "query": "mutation GenerateInvoice($input: GenerateInvoiceInput!) { generateInvoice(input: $input) { id totalAmount } }",
  "variables": { "input": { "tenantId": "{{institute_1_id}}", "subscriptionId": "{{sub_id}}" } }
}
HTTP 200
[Captures]
invoice_id: jsonpath "$.data.generateInvoice.id"

POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{reseller_token}}
{
  "query": "mutation RecordPayment($invoiceId: ID!, $input: ManualPaymentInput!) { recordManualPayment(invoiceId: $invoiceId, input: $input) { id } }",
  "variables": {
    "invoiceId": "{{invoice_id}}",
    "input": { "method": "BANK_TRANSFER", "amountPaise": "236000" }
  }
}
HTTP 200
[Captures]
payment_id: jsonpath "$.data.recordManualPayment.id"

# Step 2: Issue partial refund (₹500 = 50000 paise)
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{reseller_token}}
{
  "query": "mutation IssueRefund($paymentId: ID!, $input: RefundInput!) { issueRefund(paymentId: $paymentId, input: $input) { id status } }",
  "variables": {
    "paymentId": "{{payment_id}}",
    "input": { "amountPaise": "50000", "reason": "Partial refund test" }
  }
}
HTTP 200
[Asserts]
jsonpath "$.data.issueRefund" != null
