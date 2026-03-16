# ============================================================
# Cancel at Cycle End
# Assigns a free plan, cancels with atCycleEnd=true, and
# verifies the subscription stays ACTIVE with canceledAt set.
# ============================================================

# Step 1: Login
POST {{base_url}}/graphql
Content-Type: application/json
{
  "query": "mutation Login($username: String!, $password: String!) { login(username: $username, password: $password) { platformToken memberships { tenantId instituteName } } }",
  "variables": { "username": "{{username}}", "password": "{{password}}" }
}
HTTP 200
[Captures]
platform_token: jsonpath "$.data.login.platformToken"
tenant_id: jsonpath "$.data.login.memberships[1].tenantId"

# Step 2: Select institute
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{platform_token}}
{
  "query": "mutation SelectInstitute($tenantId: String!) { selectInstitute(tenantId: $tenantId) { accessToken } }",
  "variables": { "tenantId": "{{tenant_id}}" }
}
HTTP 200
[Captures]
access_token: jsonpath "$.data.selectInstitute.accessToken"

# Step 3: Create a free plan
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation CreatePlan($input: CreatePlanInput!) { createSubscriptionPlan(input: $input) { id } }",
  "variables": {
    "input": {
      "name": {"en": "Hurl Cycle End Test Plan"},
      "amount": 0,
      "currency": "INR",
      "billingInterval": "MONTHLY",
      "featureLimits": { "maxUsers": 5 }
    }
  }
}
HTTP 200
[Captures]
plan_id: jsonpath "$.data.createSubscriptionPlan.id"

# Step 4: Get institute ID and cancel any existing subscription
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "{ institutes { id name } }"
}
HTTP 200
[Captures]
institute_id: jsonpath "$.data.institutes[1].id"

POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "query Sub($instituteId: ID!) { subscription(instituteId: $instituteId) { id status } }",
  "variables": { "instituteId": "{{institute_id}}" }
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

# Step 5: Assign the free plan
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation AssignPlan($input: AssignPlanInput!) { assignPlanToInstitute(input: $input) { subscription { id status } } }",
  "variables": {
    "input": {
      "instituteId": "{{institute_id}}",
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

# Step 6: Cancel with atCycleEnd=true — status stays ACTIVE, canceledAt is set
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation Cancel($input: ManageSubscriptionInput!) { cancelSubscription(input: $input) { id status canceledAt } }",
  "variables": { "input": { "subscriptionId": "{{sub_id}}", "atCycleEnd": true } }
}
HTTP 200
[Asserts]
jsonpath "$.data.cancelSubscription.status" == "ACTIVE"
jsonpath "$.data.cancelSubscription.canceledAt" != null

# Step 7: Query to confirm — still ACTIVE with canceledAt
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "query Sub($instituteId: ID!) { subscription(instituteId: $instituteId) { id status canceledAt } }",
  "variables": { "instituteId": "{{institute_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.subscription.status" == "ACTIVE"
jsonpath "$.data.subscription.canceledAt" != null
