# ============================================================
# Admin List Institutes — pagination and filtering
# Tests: adminListInstitutes query with search, status filter, pagination
# ============================================================

# Step 1: Admin login (platform scope — returns accessToken directly)
POST {{base_url}}/graphql
Content-Type: application/json
{
  "query": "mutation { adminLogin(username: \"{{username}}\", password: \"{{password}}\") { accessToken } }"
}
HTTP 200
[Captures]
access_token: jsonpath "$.data.adminLogin.accessToken"
[Asserts]
jsonpath "$.data.adminLogin.accessToken" != null

# Step 2: List all institutes (no filter)
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "query AdminListInstitutes { adminListInstitutes { edges { node { id name slug type status setupStatus } cursor } pageInfo { hasNextPage hasPreviousPage startCursor endCursor } totalCount } }"
}
HTTP 200
[Asserts]
jsonpath "$.data.adminListInstitutes.edges" count >= 1
jsonpath "$.data.adminListInstitutes.totalCount" >= 1
jsonpath "$.data.adminListInstitutes.pageInfo.hasNextPage" isBoolean
jsonpath "$.data.adminListInstitutes.pageInfo.hasPreviousPage" == false
jsonpath "$.data.adminListInstitutes.edges[0].node.id" != null
jsonpath "$.data.adminListInstitutes.edges[0].cursor" != null

# Step 3: Filter by status ACTIVE
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "query AdminListInstitutes($filter: AdminListInstitutesFilterInput) { adminListInstitutes(filter: $filter) { edges { node { id status } } totalCount } }",
  "variables": { "filter": { "status": ["ACTIVE"] } }
}
HTTP 200
[Asserts]
jsonpath "$.data.adminListInstitutes.edges" not isEmpty

# Step 4: Filter by type SCHOOL
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "query AdminListInstitutes($filter: AdminListInstitutesFilterInput) { adminListInstitutes(filter: $filter) { edges { node { id type } } totalCount } }",
  "variables": { "filter": { "type": "SCHOOL" } }
}
HTTP 200
[Asserts]
jsonpath "$.data.adminListInstitutes" != null

# Step 5: Paginate — first=1
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "query AdminListInstitutes($filter: AdminListInstitutesFilterInput) { adminListInstitutes(filter: $filter) { edges { node { id } cursor } pageInfo { hasNextPage endCursor } totalCount } }",
  "variables": { "filter": { "first": 1 } }
}
HTTP 200
[Captures]
end_cursor: jsonpath "$.data.adminListInstitutes.pageInfo.endCursor"
[Asserts]
jsonpath "$.data.adminListInstitutes.edges" count == 1
jsonpath "$.data.adminListInstitutes.pageInfo.hasNextPage" == true

# Step 6: Fetch second page using cursor
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "query AdminListInstitutes($filter: AdminListInstitutesFilterInput) { adminListInstitutes(filter: $filter) { edges { node { id } } pageInfo { hasPreviousPage } } }",
  "variables": { "filter": { "first": 1, "after": "{{end_cursor}}" } }
}
HTTP 200
[Asserts]
jsonpath "$.data.adminListInstitutes.pageInfo.hasPreviousPage" == true

# Step 7: Search by name (requires pg_trgm extension — test query executes without 500)
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "query AdminListInstitutes($filter: AdminListInstitutesFilterInput) { adminListInstitutes(filter: $filter) { edges { node { id name } } totalCount } }",
  "variables": { "filter": { "search": "Demo" } }
}
HTTP 200
