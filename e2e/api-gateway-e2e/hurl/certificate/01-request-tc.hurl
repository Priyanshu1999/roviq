# ============================================================
# Request TC → status=requested, workflow starts
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
  "query": "mutation SelectInstitute($t: String!, $m: String!) { selectInstitute(selectionToken: $t, membershipId: $m) { accessToken } }",
  "variables": { "t": "{{selection_token}}", "m": "{{membership_id}}" }
}
HTTP 200
[Captures]
access_token: jsonpath "$.data.selectInstitute.accessToken"

POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation RequestTC($input: RequestTCInput!) { requestTC(input: $input) { id status reason tcSerialNumber } }",
  "variables": {
    "input": {
      "studentProfileId": "{{student_profile_id}}",
      "academicYearId": "{{academic_year_id}}",
      "reason": "Transfer to another city"
    }
  }
}
HTTP 200
[Captures]
tc_id: jsonpath "$.data.requestTC.id"
[Asserts]
jsonpath "$.data.requestTC.id" != null
jsonpath "$.data.requestTC.status" == "requested"
jsonpath "$.data.requestTC.reason" == "Transfer to another city"
