# ============================================================
# Create Subscription Plan
# Authenticates as admin, then creates a new subscription plan.
# ============================================================

# Step 1: Login (multi-org admin — returns platformToken)
POST {{base_url}}/graphql
Content-Type: application/json
{
  "query": "mutation Login($username: String!, $password: String!) { login(username: $username, password: $password) { platformToken memberships { tenantId orgName } } }",
  "variables": { "username": "{{username}}", "password": "{{password}}" }
}
HTTP 200
[Captures]
platform_token: jsonpath "$.data.login.platformToken"
tenant_id: jsonpath "$.data.login.memberships[0].tenantId"
[Asserts]
jsonpath "$.data.login.platformToken" != null
jsonpath "$.data.login.memberships" count >= 1

# Step 2: Select organization → get accessToken
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{platform_token}}
{
  "query": "mutation SelectOrg($tenantId: String!) { selectOrganization(tenantId: $tenantId) { accessToken user { id username } } }",
  "variables": { "tenantId": "{{tenant_id}}" }
}
HTTP 200
[Captures]
access_token: jsonpath "$.data.selectOrganization.accessToken"
[Asserts]
jsonpath "$.data.selectOrganization.accessToken" != null

# Step 3: Create a subscription plan
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation CreatePlan($input: CreatePlanInput!) { createSubscriptionPlan(input: $input) { id name amount currency billingInterval status featureLimits } }",
  "variables": {
    "input": {
      "name": "Hurl Test Plan",
      "description": "Created by Hurl e2e test",
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
jsonpath "$.data.createSubscriptionPlan.name" == "Hurl Test Plan"
jsonpath "$.data.createSubscriptionPlan.amount" == 49900
jsonpath "$.data.createSubscriptionPlan.currency" == "INR"
jsonpath "$.data.createSubscriptionPlan.billingInterval" == "MONTHLY"
jsonpath "$.data.createSubscriptionPlan.status" == "ACTIVE"
jsonpath "$.data.createSubscriptionPlan.featureLimits.maxUsers" == 50
