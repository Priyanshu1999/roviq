# ============================================================
# Subscription Lifecycle: Create → Pause → Verify → Resume → Verify
# Runs on institute[0] (fresh DB — no existing sub).
# ============================================================

# Step 1: Institute login (multi-institute admin)
POST {{base_url}}/graphql
Content-Type: application/json
{
  "query": "mutation { instituteLogin(username: \"{{username}}\", password: \"{{password}}\") { requiresInstituteSelection selectionToken userId memberships { membershipId tenantId } } }"
}
HTTP 200
[Captures]
membership_id: jsonpath "$.data.instituteLogin.memberships[0].membershipId"
selection_token: jsonpath "$.data.instituteLogin.selectionToken"
user_id: jsonpath "$.data.instituteLogin.userId"
tenant_id: jsonpath "$.data.instituteLogin.memberships[0].tenantId"
[Asserts]
jsonpath "$.data.instituteLogin.requiresInstituteSelection" == true

# Step 2: Select institute (first institute)
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

# Step 3: Create a free plan (amount=0 → no gateway interaction)
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation CreatePlan($input: CreatePlanInput!) { createSubscriptionPlan(input: $input) { id } }",
  "variables": {
    "input": {
      "name": {"en": "Hurl Lifecycle Test Plan"},
      "amount": 0,
      "currency": "INR",
      "billingInterval": "MONTHLY",
      "featureLimits": { "maxUsers": 10 }
    }
  }
}
HTTP 200
[Captures]
plan_id: jsonpath "$.data.createSubscriptionPlan.id"

# Step 4: Assign the free plan → creates an ACTIVE subscription (fresh DB — no existing sub)
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation AssignPlan($input: AssignPlanInput!) { assignPlanToInstitute(input: $input) { subscription { id status } } }",
  "variables": {
    "input": {
      "instituteId": "{{institute_1_id}}",
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

# Step 5: Pause the subscription
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation Pause($id: ID!) { pauseSubscription(subscriptionId: $id) { id status } }",
  "variables": { "id": "{{sub_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.pauseSubscription.id" == {{sub_id}}
jsonpath "$.data.pauseSubscription.status" == "PAUSED"

# Step 6: Re-query — verify the subscription is now PAUSED
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "query Sub($instituteId: ID!) { subscription(instituteId: $instituteId) { id status } }",
  "variables": { "instituteId": "{{institute_1_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.subscription.status" == "PAUSED"

# Step 7: Resume the subscription
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation Resume($id: ID!) { resumeSubscription(subscriptionId: $id) { id status } }",
  "variables": { "id": "{{sub_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.resumeSubscription.id" == {{sub_id}}
jsonpath "$.data.resumeSubscription.status" == "ACTIVE"

# Step 8: Final verify — subscription is back to ACTIVE
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "query Sub($instituteId: ID!) { subscription(instituteId: $instituteId) { id status } }",
  "variables": { "instituteId": "{{institute_1_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.subscription.status" == "ACTIVE"
