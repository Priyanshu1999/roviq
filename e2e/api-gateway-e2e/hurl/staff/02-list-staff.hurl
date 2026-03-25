# ============================================================
# List Staff — filter by department
# ============================================================
# Auth: inst_token injected by auth-setup.sh

# List all staff
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "query { listStaff { id employeeId designation department } }"
}
HTTP 200
[Asserts]
jsonpath "$.data.listStaff" != null

# Filter by department
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "query ListFiltered($filter: ListStaffFilterInput) { listStaff(filter: $filter) { id department } }",
  "variables": { "filter": { "department": "Science" } }
}
HTTP 200
[Asserts]
jsonpath "$.data.listStaff" != null
