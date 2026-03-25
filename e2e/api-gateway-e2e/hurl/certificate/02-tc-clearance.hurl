# ============================================================
# TC Clearance — verify clearances JSONB is populated
# (After workflow Step 2 runs, status → clearance_complete)
# ============================================================
# Auth: inst_token injected by auth-setup.sh

# Poll TC details — clearances should be populated by workflow
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
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
