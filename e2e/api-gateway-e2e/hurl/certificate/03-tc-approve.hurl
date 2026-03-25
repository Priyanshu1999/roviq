# ============================================================
# TC Approve — principal approves TC → status=approved
# ============================================================

POST {{base_url}}/graphql
Content-Type: application/json
{
  "query": "mutation { instituteLogin(username: \"{{username}}\", password: \"{{password}}\") { requiresInstituteSelection selectionToken memberships { membershipId } } }"
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
  "query": "mutation ApproveTC($id: ID!) { approveTC(id: $id) { id status } }",
  "variables": { "id": "{{tc_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.approveTC.status" == "approved"
