# ============================================================
# Archive / Restore / Delete Plan → Reject Archived Assignment
# Creates a plan, archives it, verifies assignment fails,
# restores it, then deletes it via soft-delete.
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
  "query": "mutation CreatePlan($input: CreatePlanInput!) { createSubscriptionPlan(input: $input) { id status } }",
  "variables": {
    "input": {
      "name": {"en": "Hurl Archive Test Plan"},
      "amount": "0",
      "currency": "INR",
      "interval": "MONTHLY",
      "entitlements": { "maxStudents": 5, "maxStaff": 2, "maxStorageMb": 512, "auditLogRetentionDays": 30, "features": [] },
      "resellerId": "{{reseller_id}}",
      "code": "HURL-DEACT-04"
    }
  }
}
HTTP 200
[Captures]
plan_id: jsonpath "$.data.createSubscriptionPlan.id"
[Asserts]
jsonpath "$.data.createSubscriptionPlan.status" == "ACTIVE"

# Step 3: Archive the plan
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation ArchivePlan($id: ID!) { archivePlan(id: $id) { id status } }",
  "variables": { "id": "{{plan_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.archivePlan.status" == "INACTIVE"

# Step 4: Cancel any existing subscription to free up the institute
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

# Step 5: Try to assign the archived plan — should fail
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation AssignPlan($input: AssignPlanInput!) { assignPlanToInstitute(input: $input) { subscription { id } } }",
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
[Asserts]
jsonpath "$.errors[0].message" == "Cannot assign a non-active plan"
jsonpath "$.data" == null

# Step 6: Restore the archived plan
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

# Step 7: Delete the plan (soft-delete)
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
