# ============================================================
# Novu Local Instance — API Smoke Test
# Verifies the self-hosted Novu instance is healthy and can
# create subscribers and list notifications.
# Requires: local Novu running + novu-setup completed
# ============================================================

# Step 1: Health check
GET {{novu_api_url}}/v1/health-check
HTTP 200
[Asserts]
jsonpath "$.data.status" == "ok"
jsonpath "$.data.details.db.status" == "up"

# Step 2: Create a test subscriber
POST {{novu_api_url}}/v1/subscribers
Authorization: ApiKey {{novu_api_key}}
Content-Type: application/json
{
  "subscriberId": "e2e-smoke-user",
  "firstName": "E2E",
  "lastName": "Smoke",
  "email": "smoke@roviq.dev"
}
HTTP 201
[Asserts]
jsonpath "$.data.subscriberId" == "e2e-smoke-user"

# Step 3: Verify subscriber was created
GET {{novu_api_url}}/v1/subscribers/e2e-smoke-user
Authorization: ApiKey {{novu_api_key}}
HTTP 200
[Asserts]
jsonpath "$.data.subscriberId" == "e2e-smoke-user"
jsonpath "$.data.firstName" == "E2E"

# Step 4: List notifications (empty is fine — proves the endpoint works)
GET {{novu_api_url}}/v1/notifications
Authorization: ApiKey {{novu_api_key}}
HTTP 200
[Asserts]
jsonpath "$.data" isCollection

# Step 5: Cleanup — delete the test subscriber
DELETE {{novu_api_url}}/v1/subscribers/e2e-smoke-user
Authorization: ApiKey {{novu_api_key}}
HTTP 200
