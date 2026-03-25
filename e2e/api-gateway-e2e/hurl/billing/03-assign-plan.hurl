# Auth: reseller_token injected by auth-setup.sh
# ============================================================
# Assign Plan to Institute
# Authenticates as reseller, creates a free plan, then assigns
# the free plan to the target institute.
# ============================================================

# Step 1: Create a free plan (amount=0 → no gateway interaction)
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{reseller_token}}
{
  "query": "mutation CreatePlan($input: CreatePlanInput!) { createSubscriptionPlan(input: $input) { id name amount } }",
  "variables": {
    "input": {
      "name": {"en": "Hurl Free Test Plan"},
      "amount": "0",
      "currency": "INR",
      "interval": "MONTHLY",
      "entitlements": { "maxStudents": 5, "maxStaff": 2, "maxStorageMb": 512, "auditLogRetentionDays": 30, "features": [] },
      "code": "HURL-ASSIGN-03"
    }
  }
}
HTTP 200
[Captures]
plan_id: jsonpath "$.data.createSubscriptionPlan.id"

# Step 2: Assign the free plan to the institute (fresh DB — no existing sub)
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{reseller_token}}
{
  "query": "mutation AssignPlan($input: AssignPlanInput!) { assignPlanToInstitute(input: $input) { subscription { id status tenantId planId } checkoutUrl } }",
  "variables": {
    "input": {
      "tenantId": "{{institute_2_id}}",
      "resellerId": "{{reseller_id}}",
      "planId": "{{plan_id}}",
      "provider": "RAZORPAY",
      "customerEmail": "test@roviq.com",
      "customerPhone": "+919999999999"
    }
  }
}
HTTP 200
[Asserts]
jsonpath "$.data.assignPlanToInstitute.subscription.id" != null
jsonpath "$.data.assignPlanToInstitute.subscription.status" == "ACTIVE"
jsonpath "$.data.assignPlanToInstitute.checkoutUrl" == null
