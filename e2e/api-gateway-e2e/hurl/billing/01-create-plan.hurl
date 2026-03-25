# Auth: reseller_token injected by auth-setup.sh
# ============================================================
# Create Subscription Plan
# Authenticates as reseller, then creates a new subscription plan.
# ============================================================

# Step 1: Create a subscription plan
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{reseller_token}}
{
  "query": "mutation CreatePlan($input: CreatePlanInput!) { createSubscriptionPlan(input: $input) { id name amount currency interval status entitlements } }",
  "variables": {
    "input": {
      "name": {"en": "Hurl Test Plan"},
      "description": {"en": "Created by Hurl e2e test"},
      "amount": "49900",
      "currency": "INR",
      "interval": "MONTHLY",
      "entitlements": { "maxStudents": 50, "maxStaff": 10, "maxStorageMb": 5120, "auditLogRetentionDays": 90, "features": [] },
      "code": "HURL-CREATE-01"
    }
  }
}
HTTP 200
[Captures]
plan_id: jsonpath "$.data.createSubscriptionPlan.id"
[Asserts]
jsonpath "$.data.createSubscriptionPlan.name.en" == "Hurl Test Plan"
jsonpath "$.data.createSubscriptionPlan.currency" == "INR"
jsonpath "$.data.createSubscriptionPlan.interval" == "MONTHLY"
jsonpath "$.data.createSubscriptionPlan.status" == "ACTIVE"
jsonpath "$.data.createSubscriptionPlan.entitlements.maxStudents" == 50
