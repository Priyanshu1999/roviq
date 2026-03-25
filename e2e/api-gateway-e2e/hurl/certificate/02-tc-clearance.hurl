# ============================================================
# TC Clearance — verify clearances JSONB is populated
# (After workflow Step 2 runs, status → clearance_complete)
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

# Poll TC details — clearances should be populated by workflow
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
[Options]
retry: 10
retry-interval: 2000ms
{
  "query": "query GetTC($id: ID!) { getTCDetails(id: $id) { id status clearances } }",
  "variables": { "id": "{{tc_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.getTCDetails.id" != null
jsonpath "$.data.getTCDetails.clearances" != null
