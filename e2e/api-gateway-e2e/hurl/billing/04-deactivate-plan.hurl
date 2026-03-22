# ============================================================
# Archive / Restore / Delete Plan → Reject Archived Assignment
# Creates a plan, archives it, verifies assignment fails,
# restores it, then deletes it via soft-delete.
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
  "query": "mutation CreatePlan($input: CreatePlanInput!) { createSubscriptionPlan(input: $input) { id status } }",
  "variables": {
    "input": {
      "name": {"en": "Hurl Archive Test Plan"},
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

# Step 4: Archive the plan
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation ArchivePlan($id: ID!) { archivePlan(id: $id) { id status } }",
  "variables": { "id": "{{plan_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.archivePlan.status" == "ARCHIVED"

# Step 5: Cancel any existing subscription to free up the institute
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

# Step 6: Try to assign the archived plan — should fail
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation AssignPlan($input: AssignPlanInput!) { assignPlanToInstitute(input: $input) { subscription { id } } }",
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
[Asserts]
jsonpath "$.errors[0].message" == "Cannot assign a non-active plan"
jsonpath "$.data" == null

# Step 7: Restore the archived plan
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation RestorePlan($id: ID!) { restorePlan(id: $id) { id status } }",
  "variables": { "id": "{{plan_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.restorePlan.status" == "ACTIVE"

# Step 8: Delete the plan (soft-delete)
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation DeletePlan($id: ID!) { deletePlan(id: $id) }",
  "variables": { "id": "{{plan_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.deletePlan" == true
