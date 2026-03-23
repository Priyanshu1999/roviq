# ============================================================
# Create Subscription Plan
# Authenticates as reseller, then creates a new subscription plan.
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

# Step 2: Create a subscription plan
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
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
      "resellerId": "{{reseller_id}}",
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
