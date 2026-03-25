# Auth: reseller_token injected by auth-setup.sh
# ============================================================
# Update Subscription Plan
# Creates a plan, then updates name, amount, and entitlements.
# ============================================================

# Step 1: Create a plan to update
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{reseller_token}}
{
  "query": "mutation CreatePlan($input: CreatePlanInput!) { createSubscriptionPlan(input: $input) { id name amount entitlements } }",
  "variables": {
    "input": {
      "name": {"en": "Hurl Update Test Plan"},
      "amount": "10000",
      "currency": "INR",
      "interval": "MONTHLY",
      "entitlements": { "maxStudents": 10, "maxStaff": 5, "maxStorageMb": 1024, "auditLogRetentionDays": 30, "features": [] },
      "code": "HURL-UPDATE-02"
    }
  }
}
HTTP 200
[Captures]
plan_id: jsonpath "$.data.createSubscriptionPlan.id"
[Asserts]
jsonpath "$.data.createSubscriptionPlan.name.en" == "Hurl Update Test Plan"

# Step 2: Update the plan — change name, amount, and entitlements
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{reseller_token}}
{
  "query": "mutation UpdatePlan($id: ID!, $input: UpdatePlanInput!) { updateSubscriptionPlan(id: $id, input: $input) { id name amount entitlements } }",
  "variables": {
    "id": "{{plan_id}}",
    "input": {
      "version": 1,
      "name": {"en": "Hurl Updated Plan"},
      "amount": "29900",
      "entitlements": { "maxStudents": 50, "maxStaff": 10, "maxStorageMb": 10240, "auditLogRetentionDays": 90, "features": [] }
    }
  }
}
HTTP 200
[Asserts]
jsonpath "$.data.updateSubscriptionPlan.id" == {{plan_id}}
jsonpath "$.data.updateSubscriptionPlan.name.en" == "Hurl Updated Plan"
jsonpath "$.data.updateSubscriptionPlan.entitlements.maxStudents" == 50
jsonpath "$.data.updateSubscriptionPlan.entitlements.maxStorageMb" == 10240
