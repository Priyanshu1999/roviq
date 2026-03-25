# ============================================================
# List Students — with section filter and pagination
# Depends on: 01-create-student.hurl (student exists)
# ============================================================

# Step 1: Institute login + select
POST {{base_url}}/graphql
Content-Type: application/json
{
  "query": "mutation { instituteLogin(username: \"{{username}}\", password: \"{{password}}\") { accessToken } }"
}
HTTP 200
[Captures]
access_token: jsonpath "$.data.instituteLogin.accessToken"

POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation { selectInstitute(membershipId: \"{{admin_membership_id}}\") { accessToken } }"
}
HTTP 200
[Captures]
inst_token: jsonpath "$.data.selectInstitute.accessToken"

# Step 2: List all students (no filter)
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "query { listStudents { edges { node { id admissionNumber firstName lastName academicStatus } cursor } pageInfo { hasNextPage hasPreviousPage startCursor endCursor } totalCount } }"
}
HTTP 200
[Asserts]
jsonpath "$.data.listStudents.edges" count >= 1
jsonpath "$.data.listStudents.totalCount" >= 1
jsonpath "$.data.listStudents.edges[0].node.admissionNumber" != null

# Step 3: List with section filter
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "query($filter: StudentFilterInput) { listStudents(filter: $filter) { edges { node { id } } totalCount } }",
  "variables": { "filter": { "sectionId": "{{section_id}}" } }
}
HTTP 200
[Asserts]
jsonpath "$.data.listStudents.totalCount" >= 1

# Step 4: Search by name
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "query($filter: StudentFilterInput) { listStudents(filter: $filter) { edges { node { id firstName } } totalCount } }",
  "variables": { "filter": { "search": "Aarav" } }
}
HTTP 200
[Asserts]
jsonpath "$.data.listStudents" != null
