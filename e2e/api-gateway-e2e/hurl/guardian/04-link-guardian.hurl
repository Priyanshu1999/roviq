# ============================================================
# Link Existing Guardian to Student
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

# Link guardian to student — requires pre-existing guardian_id and student_profile_id
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation LinkGuardian($input: LinkGuardianInput!) { linkGuardianToStudent(input: $input) { id relationship isPrimaryContact canPickup } }",
  "variables": {
    "input": {
      "guardianProfileId": "{{guardian_id}}",
      "studentProfileId": "{{student_profile_id}}",
      "relationship": "father",
      "isPrimaryContact": true,
      "canPickup": true
    }
  }
}
HTTP 200
[Asserts]
jsonpath "$.data.linkGuardianToStudent.id" != null
jsonpath "$.data.linkGuardianToStudent.relationship" == "father"
jsonpath "$.data.linkGuardianToStudent.isPrimaryContact" == true
