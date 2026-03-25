# ============================================================
# List Enquiries — filter by status + search
# ============================================================
# Auth: inst_token injected by auth-setup.sh

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
