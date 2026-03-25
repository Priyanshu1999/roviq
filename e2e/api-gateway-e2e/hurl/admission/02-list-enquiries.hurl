# ============================================================
# List Enquiries — filter by status + search
# ============================================================

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

# List all enquiries
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "query { listEnquiries { edges { node { id studentName status classRequested } cursor } totalCount pageInfo { hasNextPage } } }"
}
HTTP 200
[Asserts]
jsonpath "$.data.listEnquiries.edges" count >= 1
jsonpath "$.data.listEnquiries.totalCount" >= 1

# Filter by status
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "query($filter: EnquiryFilterInput) { listEnquiries(filter: $filter) { edges { node { id status } } totalCount } }",
  "variables": { "filter": { "status": "new" } }
}
HTTP 200
[Asserts]
jsonpath "$.data.listEnquiries.totalCount" >= 1

# Search by name
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "query($filter: EnquiryFilterInput) { listEnquiries(filter: $filter) { edges { node { id studentName } } totalCount } }",
  "variables": { "filter": { "search": "Priya" } }
}
HTTP 200
[Asserts]
jsonpath "$.data.listEnquiries" != null
