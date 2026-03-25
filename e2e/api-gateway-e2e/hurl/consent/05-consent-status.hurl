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
# Auth: inst_token injected by auth-setup.sh

# Query myConsentStatus as admin
# Expected: Forbidden — admin has no guardian profile
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "query { myConsentStatus { studentProfileId purpose isGranted lastUpdatedAt } }"
}
HTTP 200
[Asserts]
# Admin calling myConsentStatus returns a Forbidden error because
# the admin's membershipId does not have a guardian profile.
jsonpath "$.errors" count >= 1
jsonpath "$.errors[0].message" contains "guardian"
