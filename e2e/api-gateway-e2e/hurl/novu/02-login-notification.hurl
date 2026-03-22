# ============================================================
# Login Notification — End-to-End Flow
# Verifies that logging in via Roviq produces a "New sign-in"
# notification in the local Novu instance.
#
# Flow: login → NATS auth.security event → notification-service
#       → Novu trigger (system-auth workflow) → in-app notification
#
# Requires:
#   - Local Novu running + novu-setup completed
#   - api-gateway running
#   - notification-service running
#   - Bridge synced
# ============================================================

# Step 1: Institute login to Roviq (multi-institute admin) — emits NATS auth.security LOGIN event
POST {{gateway_url}}/graphql
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

# Step 2: Select institute to get access token
POST {{gateway_url}}/graphql
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

# Step 3: Ensure subscriber exists in Novu
POST {{novu_api_url}}/v1/subscribers
Authorization: ApiKey {{novu_api_key}}
Content-Type: application/json
{
  "subscriberId": "{{user_id}}"
}
HTTP *
[Asserts]
status < 500

# Step 4: Wait for login notification to arrive (async: NATS → Novu)
GET {{novu_api_url}}/v1/notifications?subscriberIds={{user_id}}
Authorization: ApiKey {{novu_api_key}}
[Options]
retry: 10
retry-interval: 3000ms
HTTP 200
[Asserts]
jsonpath "$.data" isCollection
jsonpath "$.data" count >= 1
