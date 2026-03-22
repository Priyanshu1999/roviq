# ============================================================
# Create Subscription Plan
# Authenticates as admin, then creates a new subscription plan.
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

# Step 2: Select institute → get accessToken
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

# Step 3: Create a subscription plan
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation CreatePlan($input: CreatePlanInput!) { createSubscriptionPlan(input: $input) { id name amount currency billingInterval status featureLimits } }",
  "variables": {
    "input": {
      "name": {"en": "Hurl Test Plan"},
      "description": {"en": "Created by Hurl e2e test"},
      "amount": 49900,
      "currency": "INR",
      "billingInterval": "MONTHLY",
      "featureLimits": { "maxUsers": 50, "maxSections": 10, "maxStorageGb": 5 }
    }
  }
}
HTTP 200
[Captures]
plan_id: jsonpath "$.data.createSubscriptionPlan.id"
[Asserts]
jsonpath "$.data.createSubscriptionPlan.name.en" == "Hurl Test Plan"
jsonpath "$.data.createSubscriptionPlan.amount" == 49900
jsonpath "$.data.createSubscriptionPlan.currency" == "INR"
jsonpath "$.data.createSubscriptionPlan.billingInterval" == "MONTHLY"
jsonpath "$.data.createSubscriptionPlan.status" == "ACTIVE"
jsonpath "$.data.createSubscriptionPlan.featureLimits.maxUsers" == 50
