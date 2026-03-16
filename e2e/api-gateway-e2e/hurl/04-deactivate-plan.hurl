# ============================================================
# Deactivate Plan → Reject Assignment
# Creates a plan, deactivates it, then verifies that assigning
# the inactive plan to an org fails with an error.
# ============================================================

# Step 1: Login
POST {{base_url}}/graphql
Content-Type: application/json
{
  "query": "mutation Login($username: String!, $password: String!) { login(username: $username, password: $password) { platformToken memberships { tenantId orgName } } }",
  "variables": { "username": "{{username}}", "password": "{{password}}" }
}
HTTP 200
[Captures]
platform_token: jsonpath "$.data.login.platformToken"
tenant_id: jsonpath "$.data.login.memberships[1].tenantId"

# Step 2: Select organization
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{platform_token}}
{
  "query": "mutation SelectOrg($tenantId: String!) { selectOrganization(tenantId: $tenantId) { accessToken } }",
  "variables": { "tenantId": "{{tenant_id}}" }
}
HTTP 200
[Captures]
access_token: jsonpath "$.data.selectOrganization.accessToken"

# Step 3: Create a free plan
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation CreatePlan($input: CreatePlanInput!) { createSubscriptionPlan(input: $input) { id status } }",
  "variables": {
    "input": {
      "name": "Hurl Deactivate Test Plan",
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
[Asserts]
jsonpath "$.data.createSubscriptionPlan.status" == "ACTIVE"

# Step 4: Deactivate the plan
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation UpdatePlan($id: ID!, $input: UpdatePlanInput!) { updateSubscriptionPlan(id: $id, input: $input) { id status } }",
  "variables": {
    "id": "{{plan_id}}",
    "input": { "status": "INACTIVE" }
  }
}
HTTP 200
[Asserts]
jsonpath "$.data.updateSubscriptionPlan.status" == "INACTIVE"

# Step 5: Get org ID
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "{ organizations { id name } }"
}
HTTP 200
[Captures]
org_id: jsonpath "$.data.organizations[1].id"

# Step 6: Cancel any existing subscription to free up the org
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "query Sub($orgId: ID!) { subscription(organizationId: $orgId) { id status } }",
  "variables": { "orgId": "{{org_id}}" }
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

# Step 7: Try to assign the deactivated plan — should fail
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation AssignPlan($input: AssignPlanInput!) { assignPlanToOrganization(input: $input) { subscription { id } } }",
  "variables": {
    "input": {
      "organizationId": "{{org_id}}",
      "planId": "{{plan_id}}",
      "provider": "RAZORPAY",
      "customerEmail": "test@roviq.com",
      "customerPhone": "+919999999999"
    }
  }
}
HTTP 200
[Asserts]
jsonpath "$.errors[0].message" == "Cannot assign an inactive plan"
jsonpath "$.data" == null
