# ============================================================
# Consent Status — query current consent state for guardian
#
# Tests that myConsentStatus also requires guardian authentication.
# The query resolves the guardian profile from the caller's
# membershipId, so non-guardian users receive a Forbidden error.
#
# Full consent status querying (after grant + withdrawal) is
# verified in Vitest integration tests.
# ============================================================

# Step 1: Institute login as admin
POST {{base_url}}/graphql
Content-Type: application/json
{
  "query": "mutation { instituteLogin(username: \"{{username}}\", password: \"{{password}}\") { requiresInstituteSelection selectionToken memberships { membershipId tenantId } } }"
}
HTTP 200
[Captures]
membership_id: jsonpath "$.data.instituteLogin.memberships[0].membershipId"
selection_token: jsonpath "$.data.instituteLogin.selectionToken"

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

# Step 3: Query myConsentStatus as admin
# Expected: Forbidden — admin has no guardian profile
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "query { myConsentStatus { studentProfileId purpose isGranted lastUpdatedAt } }"
}
HTTP 200
[Asserts]
# Admin calling myConsentStatus returns a Forbidden error because
# the admin's membershipId does not have a guardian profile.
jsonpath "$.errors" count >= 1
jsonpath "$.errors[0].message" contains "guardian"
