# ============================================================
# TC Approve — principal approves TC → status=approved
# ============================================================
# Auth: inst_token injected by auth-setup.sh

POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "mutation ApproveTC($id: ID!) { approveTC(id: $id) { id status } }",
  "variables": { "id": "{{tc_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.approveTC.status" == "approved"
