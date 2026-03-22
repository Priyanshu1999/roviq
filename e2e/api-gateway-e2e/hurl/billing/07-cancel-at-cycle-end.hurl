# ============================================================
# Cancel at Cycle End
# Assigns a free plan, cancels with atCycleEnd=true, and
# verifies the subscription stays ACTIVE with canceledAt set.
# ============================================================

# Step 1: Institute login
POST {{base_url}}/graphql
Content-Type: application/json
{
  "query": "mutation { instituteLogin(username: \"{{username}}\", password: \"{{password}}\") { requiresInstituteSelection selectionToken userId memberships { membershipId tenantId } } }"
}
HTTP 200
[Captures]
membership_id: jsonpath "$.data.instituteLogin.memberships[1].membershipId"
selection_token: jsonpath "$.data.instituteLogin.selectionToken"
user_id: jsonpath "$.data.instituteLogin.userId"
tenant_id: jsonpath "$.data.instituteLogin.memberships[1].tenantId"
[Asserts]
jsonpath "$.data.instituteLogin.requiresInstituteSelection" == true

# Step 2: Select institute
POST {{base_url}}/graphql
Content-Type: application/json
{
  "query": "mutation SelectInstitute($selectionToken: String!, $membershipId: String!) { selectInstitute(selectionToken: $selectionToken, membershipId: $membershipId) { accessToken } }",
  "variables": { "selectionToken": "{{selection_token}}", "membershipId": "{{membership_id}}" }
}
HTTP 200
[Captures]
access_token: jsonpath "$.data.selectInstitute.accessToken"
[Asserts]
jsonpath "$.data.selectInstitute.accessToken" != null

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

# Step 4: Cancel any existing subscription
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

# Step 5: Assign the free plan
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation AssignPlan($input: AssignPlanInput!) { assignPlanToInstitute(input: $input) { subscription { id status } } }",
  "variables": {
    "input": {
      "instituteId": "{{institute_2_id}}",
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
  "variables": { "instituteId": "{{institute_2_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.subscription.status" == "ACTIVE"
jsonpath "$.data.subscription.canceledAt" != null
