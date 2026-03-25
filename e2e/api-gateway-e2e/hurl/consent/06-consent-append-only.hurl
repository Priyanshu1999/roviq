# ============================================================
# Consent Append-Only Verification (stub)
#
# The append-only nature of consent_records is enforced at two
# levels:
#
# 1. RLS policy: UPDATE and DELETE on consent_records are
#    blocked for roviq_app (USING (false)). Only INSERT is
#    allowed, ensuring immutability.
#
# 2. Service layer: grantConsent() and withdrawConsent() both
#    INSERT new rows — they never UPDATE existing records. The
#    latest record per (guardian, student, purpose) determines
#    the current consent state.
#
# These guarantees are verified in:
# - bot-consent-schema.integration.test.ts: RLS policy tests
#   that directly attempt UPDATE/DELETE and assert failure
# - consent.service.ts: append-only INSERT logic
#
# This Hurl test verifies the GraphQL schema is correctly
# exposing the consent record model with the expected fields
# via an introspection-style query.
# ============================================================

# Step 1: Institute login
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

# Step 3: Verify the ConsentRecordModel schema exists with
# expected fields via __type introspection
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "{ __type(name: \"ConsentRecordModel\") { name fields { name type { name kind ofType { name } } } } }"
}
HTTP 200
[Asserts]
jsonpath "$.data.__type.name" == "ConsentRecordModel"
# Verify key append-only fields exist
jsonpath "$.data.__type.fields[?(@.name=='id')]" count == 1
jsonpath "$.data.__type.fields[?(@.name=='purpose')]" count == 1
jsonpath "$.data.__type.fields[?(@.name=='isGranted')]" count == 1
jsonpath "$.data.__type.fields[?(@.name=='grantedAt')]" count == 1
jsonpath "$.data.__type.fields[?(@.name=='withdrawnAt')]" count == 1
jsonpath "$.data.__type.fields[?(@.name=='createdAt')]" count == 1
# No updatedAt field — consent records are immutable
jsonpath "$.data.__type.fields[?(@.name=='updatedAt')]" count == 0
