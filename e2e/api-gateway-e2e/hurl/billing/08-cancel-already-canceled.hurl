# Auth: reseller_token injected by auth-setup.sh
# ============================================================
# Cancel Already-Canceled Subscription
# Cancels a subscription, then tries to cancel it again —
# should fail with "already canceled" error.
# ============================================================

# Step 1: Create a free plan
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{reseller_token}}
{
  "query": "mutation CreatePlan($input: CreatePlanInput!) { createSubscriptionPlan(input: $input) { id } }",
  "variables": {
    "input": {
      "name": {"en": "Hurl Double Cancel Test Plan"},
      "amount": "0",
      "currency": "INR",
      "interval": "MONTHLY",
      "entitlements": { "maxStudents": 5, "maxStaff": 2, "maxStorageMb": 512, "auditLogRetentionDays": 30, "features": [] },
      "resellerId": "{{reseller_id}}",
      "code": "HURL-DBLCNL-08"
    }
  }
}
HTTP 200
[Captures]
plan_id: jsonpath "$.data.createSubscriptionPlan.id"

# Step 2: Cancel any existing subscription
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{reseller_token}}
{
  "query": "query Sub($instituteId: ID!) { subscription(instituteId: $instituteId) { id status } }",
  "variables": { "instituteId": "{{institute_2_id}}" }
}
HTTP 200
[Captures]
existing_sub_id: jsonpath "$.data.subscription.id"

POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{reseller_token}}
{
  "query": "mutation Cancel($input: ManageSubscriptionInput!) { cancelSubscription(input: $input) { id status } }",
  "variables": { "input": { "subscriptionId": "{{existing_sub_id}}", "atCycleEnd": false } }
}
HTTP 200

# Step 3: Assign the free plan
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{reseller_token}}
{
  "query": "mutation AssignPlan($input: AssignPlanInput!) { assignPlanToInstitute(input: $input) { subscription { id status } } }",
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
[Captures]
sub_id: jsonpath "$.data.assignPlanToInstitute.subscription.id"

# Step 4: Cancel the subscription (first time — should succeed)
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{reseller_token}}
{
  "query": "mutation Cancel($input: ManageSubscriptionInput!) { cancelSubscription(input: $input) { id status } }",
  "variables": { "input": { "subscriptionId": "{{sub_id}}", "atCycleEnd": false } }
}
HTTP 200
[Asserts]
jsonpath "$.data.cancelSubscription.status" == "CANCELED"

# Step 5: Cancel again — should fail
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{reseller_token}}
{
  "query": "mutation Cancel($input: ManageSubscriptionInput!) { cancelSubscription(input: $input) { id status } }",
  "variables": { "input": { "subscriptionId": "{{sub_id}}", "atCycleEnd": false } }
}
HTTP 200
[Asserts]
jsonpath "$.errors[0].message" == "Subscription is already canceled or completed"
jsonpath "$.data" == null
