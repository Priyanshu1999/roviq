# ============================================================
# Update Subscription Plan
# Creates a plan, then updates name, amount, and featureLimits.
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
tenant_id: jsonpath "$.data.login.memberships[0].tenantId"

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

# Step 3: Create a plan to update
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation CreatePlan($input: CreatePlanInput!) { createSubscriptionPlan(input: $input) { id name amount featureLimits } }",
  "variables": {
    "input": {
      "name": {"en": "Hurl Update Test Plan"},
      "amount": 10000,
      "currency": "INR",
      "billingInterval": "MONTHLY",
      "featureLimits": { "maxUsers": 10 }
    }
  }
}
HTTP 200
[Captures]
plan_id: jsonpath "$.data.createSubscriptionPlan.id"
[Asserts]
jsonpath "$.data.createSubscriptionPlan.name.en" == "Hurl Update Test Plan"
jsonpath "$.data.createSubscriptionPlan.amount" == 10000

# Step 4: Update the plan — change name, amount, and featureLimits
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation UpdatePlan($id: ID!, $input: UpdatePlanInput!) { updateSubscriptionPlan(id: $id, input: $input) { id name amount featureLimits } }",
  "variables": {
    "id": "{{plan_id}}",
    "input": {
      "name": {"en": "Hurl Updated Plan"},
      "amount": 29900,
      "featureLimits": { "maxUsers": 50, "maxStorageGb": 10 }
    }
  }
}
HTTP 200
[Asserts]
jsonpath "$.data.updateSubscriptionPlan.id" == {{plan_id}}
jsonpath "$.data.updateSubscriptionPlan.name.en" == "Hurl Updated Plan"
jsonpath "$.data.updateSubscriptionPlan.amount" == 29900
jsonpath "$.data.updateSubscriptionPlan.featureLimits.maxUsers" == 50
jsonpath "$.data.updateSubscriptionPlan.featureLimits.maxStorageGb" == 10
