# ============================================================
# List Staff — filter by department
# ============================================================

# Step 1: Institute login + select
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

# Step 2: List all staff
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "query { listStaff { id employeeId designation department } }"
}
HTTP 200
[Asserts]
jsonpath "$.data.listStaff" != null

# Step 3: Filter by department
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "query ListFiltered($filter: ListStaffFilterInput) { listStaff(filter: $filter) { id department } }",
  "variables": { "filter": { "department": "Science" } }
}
HTTP 200
[Asserts]
jsonpath "$.data.listStaff" != null
