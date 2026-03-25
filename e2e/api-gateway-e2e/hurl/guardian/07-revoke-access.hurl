# ============================================================
# Divorce Scenario — Revoke Guardian Access
# can_pickup=false, link preserved for TC history
# ============================================================

POST {{base_url}}/graphql
Content-Type: application/json
{
  "query": "mutation { instituteLogin(username: \"{{username}}\", password: \"{{password}}\") { requiresInstituteSelection selectionToken memberships { membershipId tenantId } } }"
}
HTTP 200
[Captures]
membership_id: jsonpath "$.data.instituteLogin.memberships[0].membershipId"
selection_token: jsonpath "$.data.instituteLogin.selectionToken"

POST {{base_url}}/graphql
Content-Type: application/json
{
  "query": "mutation SelectInstitute($selectionToken: String!, $membershipId: String!) { selectInstitute(selectionToken: $selectionToken, membershipId: $membershipId) { accessToken } }",
  "variables": { "selectionToken": "{{selection_token}}", "membershipId": "{{membership_id}}" }
}
HTTP 200
[Captures]
access_token: jsonpath "$.data.selectInstitute.accessToken"

# Revoke access — link preserved, can_pickup=false
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation RevokeAccess($input: RevokeGuardianAccessInput!) { revokeGuardianAccess(input: $input) { id canPickup isPrimaryContact } }",
  "variables": {
    "input": {
      "guardianProfileId": "{{guardian_id}}",
      "studentProfileId": "{{student_profile_id}}",
      "reason": "Court order - custody change"
    }
  }
}
HTTP 200
[Asserts]
jsonpath "$.data.revokeGuardianAccess.canPickup" == false
jsonpath "$.data.revokeGuardianAccess.isPrimaryContact" == false
# Link ID still exists (not deleted)
jsonpath "$.data.revokeGuardianAccess.id" != null
