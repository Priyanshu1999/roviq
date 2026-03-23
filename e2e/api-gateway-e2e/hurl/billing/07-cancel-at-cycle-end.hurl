# ============================================================
# Cancel at Cycle End
# Assigns a free plan, cancels with atCycleEnd=true, and
# verifies the subscription stays ACTIVE with cancelledAt set.
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

# Step 2: Create a free plan
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation CreatePlan($input: CreatePlanInput!) { createSubscriptionPlan(input: $input) { id } }",
  "variables": {
    "input": {
      "name": {"en": "Hurl Cycle End Test Plan"},
      "amount": "0",
      "currency": "INR",
      "interval": "MONTHLY",
      "entitlements": { "maxStudents": 5, "maxStaff": 2, "maxStorageMb": 512, "auditLogRetentionDays": 30, "features": [] },
      "resellerId": "{{reseller_id}}",
      "code": "HURL-CYCLE-07"
    }
  }
}
HTTP 200
[Captures]
plan_id: jsonpath "$.data.createSubscriptionPlan.id"

# Step 3: Cancel any existing subscription
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "query Sub($instituteId: ID!) { subscription(instituteId: $instituteId) { id status } }",
  "variables": { "instituteId": "{{institute_2_id}}" }
}
HTTP 200
[Captures]
existing_sub_id: jsonpath "$.data.subscription.id"

POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation Cancel($input: ManageSubscriptionInput!) { cancelSubscription(input: $input) { id status } }",
  "variables": { "input": { "subscriptionId": "{{existing_sub_id}}", "atCycleEnd": false } }
}
HTTP 200

# Step 4: Assign the free plan
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
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
[Asserts]
jsonpath "$.data.assignPlanToInstitute.subscription.status" == "ACTIVE"

# Step 5: Cancel with atCycleEnd=true — status stays ACTIVE, cancelledAt is set
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation Cancel($input: ManageSubscriptionInput!) { cancelSubscription(input: $input) { id status cancelledAt } }",
  "variables": { "input": { "subscriptionId": "{{sub_id}}", "atCycleEnd": true } }
}
HTTP 200
[Asserts]
jsonpath "$.data.cancelSubscription.status" == "ACTIVE"
jsonpath "$.data.cancelSubscription.cancelledAt" != null

# Step 6: Query to confirm — still ACTIVE with cancelledAt
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "query Sub($instituteId: ID!) { subscription(instituteId: $instituteId) { id status cancelledAt } }",
  "variables": { "instituteId": "{{institute_2_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.subscription.status" == "ACTIVE"
jsonpath "$.data.subscription.cancelledAt" != null
