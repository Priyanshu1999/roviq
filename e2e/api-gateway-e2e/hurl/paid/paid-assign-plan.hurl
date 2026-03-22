# ============================================================
# Paid Plan Assignment (requires gateway sandbox credentials)
# Creates a paid plan, assigns it to an institute, and verifies that
# a checkoutUrl is returned with PENDING_PAYMENT status.
# ============================================================

# Step 1: Institute login
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

# Step 3: Create a paid plan (amount > 0 triggers gateway interaction)
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation CreatePlan($input: CreatePlanInput!) { createSubscriptionPlan(input: $input) { id name amount } }",
  "variables": {
    "input": {
      "name": {"en": "Hurl Paid Test Plan"},
      "amount": 49900,
      "currency": "INR",
      "billingInterval": "MONTHLY",
      "featureLimits": { "maxUsers": 25 }
    }
  }
}
HTTP 200
[Captures]
plan_id: jsonpath "$.data.createSubscriptionPlan.id"
[Asserts]
jsonpath "$.data.createSubscriptionPlan.amount" == 49900

# Step 4: Assign the paid plan → gateway creates provider plan + subscription (fresh DB — no existing sub)
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation AssignPlan($input: AssignPlanInput!) { assignPlanToInstitute(input: $input) { subscription { id status providerSubscriptionId } checkoutUrl } }",
  "variables": {
    "input": {
      "instituteId": "{{institute_1_id}}",
      "planId": "{{plan_id}}",
      "provider": "{{provider}}",
      "customerEmail": "test@roviq.com",
      "customerPhone": "+919999999999"
    }
  }
}
HTTP 200
[Captures]
sub_id: jsonpath "$.data.assignPlanToInstitute.subscription.id"
checkout_url: jsonpath "$.data.assignPlanToInstitute.checkoutUrl"
[Asserts]
jsonpath "$.data.assignPlanToInstitute.subscription.status" == "PENDING_PAYMENT"
jsonpath "$.data.assignPlanToInstitute.subscription.providerSubscriptionId" != null
jsonpath "$.data.assignPlanToInstitute.checkoutUrl" != null

# Step 5: Verify subscription via query
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "query Sub($instituteId: ID!) { subscription(instituteId: $instituteId) { id status providerSubscriptionId } }",
  "variables": { "instituteId": "{{institute_1_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.subscription.id" == {{sub_id}}
jsonpath "$.data.subscription.status" == "PENDING_PAYMENT"
jsonpath "$.data.subscription.providerSubscriptionId" != null
