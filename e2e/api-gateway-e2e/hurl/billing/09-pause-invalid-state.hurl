# ============================================================
# Pause / Resume Invalid State
# Tests that pause rejects non-active subs and resume rejects
# non-paused subs.
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
      "name": {"en": "Hurl Invalid State Test Plan"},
      "amount": "0",
      "currency": "INR",
      "interval": "MONTHLY",
      "entitlements": { "maxStudents": 5, "maxStaff": 2, "maxStorageMb": 512, "auditLogRetentionDays": 30, "features": [] },
      "resellerId": "{{reseller_id}}",
      "code": "HURL-INVST-09"
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

# Step 5: Resume an ACTIVE subscription — should fail (not paused)
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation Resume($id: ID!) { resumeSubscription(subscriptionId: $id) { id status } }",
  "variables": { "id": "{{sub_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.errors[0].message" == "Only paused subscriptions can be resumed"
jsonpath "$.data" == null

# Step 6: Pause the subscription (valid — it's ACTIVE)
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation Pause($id: ID!) { pauseSubscription(subscriptionId: $id) { id status } }",
  "variables": { "id": "{{sub_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.pauseSubscription.status" == "PAUSED"

# Step 7: Pause again — should fail (already paused, not active)
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation Pause($id: ID!) { pauseSubscription(subscriptionId: $id) { id status } }",
  "variables": { "id": "{{sub_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.errors[0].message" == "Only active subscriptions can be paused"
jsonpath "$.data" == null
