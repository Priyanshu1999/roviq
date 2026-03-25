# Auth: reseller_token injected by auth-setup.sh
# ============================================================
# Subscription Lifecycle: Create → Pause → Verify → Resume → Verify
# Runs on institute[0] (fresh DB — no existing sub).
# ============================================================

# Step 1: Create a free plan (amount=0 → no gateway interaction)
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{reseller_token}}
{
  "query": "mutation CreatePlan($input: CreatePlanInput!) { createSubscriptionPlan(input: $input) { id } }",
  "variables": {
    "input": {
      "name": {"en": "Hurl Lifecycle Test Plan"},
      "amount": "0",
      "currency": "INR",
      "interval": "MONTHLY",
      "entitlements": { "maxStudents": 10, "maxStaff": 5, "maxStorageMb": 1024, "auditLogRetentionDays": 30, "features": [] },
      "resellerId": "{{reseller_id}}",
      "code": "HURL-LIFE-06"
    }
  }
}
HTTP 200
[Captures]
plan_id: jsonpath "$.data.createSubscriptionPlan.id"

# Step 2: Assign the free plan → creates an ACTIVE subscription (fresh DB — no existing sub)
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{reseller_token}}
{
  "query": "mutation AssignPlan($input: AssignPlanInput!) { assignPlanToInstitute(input: $input) { subscription { id status } } }",
  "variables": {
    "input": {
      "tenantId": "{{institute_1_id}}",
      "resellerId": "{{reseller_id}}",
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

# Step 3: Pause the subscription
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{reseller_token}}
{
  "query": "mutation Pause($id: ID!) { pauseSubscription(subscriptionId: $id) { id status } }",
  "variables": { "id": "{{sub_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.pauseSubscription.id" == {{sub_id}}
jsonpath "$.data.pauseSubscription.status" == "PAUSED"

# Step 4: Re-query — verify the subscription is now PAUSED
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{reseller_token}}
{
  "query": "query Sub($instituteId: ID!) { subscription(instituteId: $instituteId) { id status } }",
  "variables": { "instituteId": "{{institute_1_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.subscription.status" == "PAUSED"

# Step 5: Resume the subscription
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{reseller_token}}
{
  "query": "mutation Resume($id: ID!) { resumeSubscription(subscriptionId: $id) { id status } }",
  "variables": { "id": "{{sub_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.resumeSubscription.id" == {{sub_id}}
jsonpath "$.data.resumeSubscription.status" == "ACTIVE"

# Step 6: Final verify — subscription is back to ACTIVE
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{reseller_token}}
{
  "query": "query Sub($instituteId: ID!) { subscription(instituteId: $instituteId) { id status } }",
  "variables": { "instituteId": "{{institute_1_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.subscription.status" == "ACTIVE"
