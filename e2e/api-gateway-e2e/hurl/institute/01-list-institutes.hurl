# ============================================================
# List Institutes — pagination and filtering
# Tests: institutes query with search, status filter, pagination
# ============================================================

# Step 1: Institute login
POST {{base_url}}/graphql
Content-Type: application/json
{
  "query": "mutation { instituteLogin(username: \"{{username}}\", password: \"{{password}}\") { requiresInstituteSelection selectionToken userId memberships { membershipId tenantId } } }"
}
HTTP 200
[Captures]
membership_id: jsonpath "$.data.instituteLogin.memberships[0].membershipId"
selection_token: jsonpath "$.data.instituteLogin.selectionToken"
user_id: jsonpath "$.data.instituteLogin.userId"
tenant_id: jsonpath "$.data.instituteLogin.memberships[0].tenantId"
[Asserts]
jsonpath "$.data.instituteLogin.requiresInstituteSelection" == true

# Step 2: Select institute → get accessToken
POST {{base_url}}/graphql
Content-Type: application/json
{
  "query": "mutation SelectInstitute($selectionToken: String!, $membershipId: String!) { selectInstitute(selectionToken: $selectionToken, membershipId: $membershipId) { accessToken } }",
  "variables": { "selectionToken": "{{selection_token}}", "membershipId": "{{membership_id}}" }
}
HTTP 200
[Captures]
access_token: jsonpath "$.data.selectInstitute.accessToken"
[Asserts]
jsonpath "$.data.selectInstitute.accessToken" != null

# Step 3: List all institutes (no filter)
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "query ListInstitutes { institutes { edges { node { id name slug type status setupStatus } cursor } pageInfo { hasNextPage hasPreviousPage startCursor endCursor } totalCount } }"
}
HTTP 200
[Asserts]
jsonpath "$.data.institutes.edges" count >= 1
jsonpath "$.data.institutes.totalCount" >= 1
jsonpath "$.data.institutes.pageInfo.hasNextPage" isBoolean
jsonpath "$.data.institutes.pageInfo.hasPreviousPage" == false
jsonpath "$.data.institutes.edges[0].node.id" != null
jsonpath "$.data.institutes.edges[0].cursor" != null

# Step 4: Filter by status ACTIVE
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "query ListInstitutes($filter: InstituteFilterInput) { institutes(filter: $filter) { edges { node { id status } } totalCount } }",
  "variables": { "filter": { "status": "ACTIVE" } }
}
HTTP 200
[Asserts]
jsonpath "$.data.institutes.edges" not isEmpty

# Step 5: Filter by type SCHOOL
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "query ListInstitutes($filter: InstituteFilterInput) { institutes(filter: $filter) { edges { node { id type } } totalCount } }",
  "variables": { "filter": { "type": "SCHOOL" } }
}
HTTP 200
[Asserts]
jsonpath "$.data.institutes" != null

# Step 6: Paginate — first=1
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "query ListInstitutes($filter: InstituteFilterInput) { institutes(filter: $filter) { edges { node { id } cursor } pageInfo { hasNextPage endCursor } totalCount } }",
  "variables": { "filter": { "first": 1 } }
}
HTTP 200
[Captures]
end_cursor: jsonpath "$.data.institutes.pageInfo.endCursor"
[Asserts]
jsonpath "$.data.institutes.edges" count == 1
jsonpath "$.data.institutes.pageInfo.hasNextPage" == true

# Step 7: Fetch second page using cursor
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "query ListInstitutes($filter: InstituteFilterInput) { institutes(filter: $filter) { edges { node { id } } pageInfo { hasPreviousPage } } }",
  "variables": { "filter": { "first": 1, "after": "{{end_cursor}}" } }
}
HTTP 200
[Asserts]
jsonpath "$.data.institutes.pageInfo.hasPreviousPage" == true

# Step 8: Search by name
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "query ListInstitutes($filter: InstituteFilterInput) { institutes(filter: $filter) { edges { node { id name } } totalCount } }",
  "variables": { "filter": { "search": "Demo" } }
}
HTTP 200
[Asserts]
jsonpath "$.data.institutes" != null
