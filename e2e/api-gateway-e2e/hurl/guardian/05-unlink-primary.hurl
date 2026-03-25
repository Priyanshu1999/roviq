# ============================================================
# Unlink Primary Guardian Without Replacement → Error
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

# Attempt to unlink primary contact without newPrimaryGuardianId → expect error
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation UnlinkGuardian($input: UnlinkGuardianInput!) { unlinkGuardianFromStudent(input: $input) }",
  "variables": {
    "input": {
      "guardianProfileId": "{{guardian_id}}",
      "studentProfileId": "{{student_profile_id}}"
    }
  }
}
HTTP 200
[Asserts]
jsonpath "$.errors" != null
jsonpath "$.errors[0].message" contains "primary"
