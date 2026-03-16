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

# Step 1: Login to Roviq (multi-org admin) — emits NATS auth.security LOGIN event
POST {{gateway_url}}/graphql
Content-Type: application/json
{
  "query": "mutation Login($username: String!, $password: String!) { login(username: $username, password: $password) { platformToken memberships { tenantId } } }",
  "variables": { "username": "{{username}}", "password": "{{password}}" }
}
HTTP 200
[Captures]
platform_token: jsonpath "$.data.login.platformToken"
tenant_id: jsonpath "$.data.login.memberships[0].tenantId"
[Asserts]
jsonpath "$.data.login.platformToken" != null

# Step 2: Select organization to get user ID
POST {{gateway_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{platform_token}}
{
  "query": "mutation SelectOrg($tenantId: String!) { selectOrganization(tenantId: $tenantId) { accessToken user { id } } }",
  "variables": { "tenantId": "{{tenant_id}}" }
}
HTTP 200
[Captures]
user_id: jsonpath "$.data.selectOrganization.user.id"
[Asserts]
jsonpath "$.data.selectOrganization.user.id" != null

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
