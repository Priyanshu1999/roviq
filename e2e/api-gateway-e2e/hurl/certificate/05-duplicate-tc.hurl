# ============================================================
# Duplicate TC — request with original_tc_id, is_duplicate=true
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
  "query": "mutation DupTC($input: RequestDuplicateTCInput!) { requestDuplicateTC(input: $input) { id isDuplicate originalTcId status } }",
  "variables": {
    "input": {
      "originalTcId": "{{tc_id}}",
      "reason": "Original TC lost — FIR filed on 2026-03-20"
    }
  }
}
HTTP 200
[Asserts]
jsonpath "$.data.requestDuplicateTC.isDuplicate" == true
jsonpath "$.data.requestDuplicateTC.originalTcId" == "{{tc_id}}"
jsonpath "$.data.requestDuplicateTC.status" == "duplicate_requested"
