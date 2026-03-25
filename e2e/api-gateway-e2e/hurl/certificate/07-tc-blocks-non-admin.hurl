# ============================================================
# TC blocks non-admin — teacher cannot request TC → 403/error
# ============================================================

# NOTE: This test requires a teacher-scoped login.
# In a fresh seeded DB, use teacher credentials.
# The CASL guard should deny the requestTC mutation for teacher role.

POST {{base_url}}/graphql
Content-Type: application/json
{
  "query": "mutation { instituteLogin(username: \"{{teacher_username}}\", password: \"{{teacher_password}}\") { requiresInstituteSelection selectionToken memberships { membershipId } } }"
}
HTTP 200
[Captures]
membership_id: jsonpath "$.data.instituteLogin.memberships[0].membershipId"
selection_token: jsonpath "$.data.instituteLogin.selectionToken"

POST {{base_url}}/graphql
Content-Type: application/json
{
  "query": "mutation SelectInstitute($t: String!, $m: String!) { selectInstitute(selectionToken: $t, membershipId: $m) { accessToken } }",
  "variables": { "t": "{{selection_token}}", "m": "{{membership_id}}" }
}
HTTP 200
[Captures]
access_token: jsonpath "$.data.selectInstitute.accessToken"

# Attempt TC request as teacher → should be denied by CASL
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation RequestTC($input: RequestTCInput!) { requestTC(input: $input) { id status } }",
  "variables": {
    "input": {
      "studentProfileId": "{{student_profile_id}}",
      "academicYearId": "{{academic_year_id}}",
      "reason": "Unauthorized attempt"
    }
  }
}
HTTP 200
[Asserts]
jsonpath "$.errors" != null
jsonpath "$.errors[0].message" contains "Forbidden"
