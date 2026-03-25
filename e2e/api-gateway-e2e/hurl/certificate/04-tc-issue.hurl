# ============================================================
# TC Issue — generates PDF URL, student → transferred_out
# ============================================================
# Auth: inst_token injected by auth-setup.sh

POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "mutation IssueTC($id: ID!) { issueTC(id: $id) { id status tcSerialNumber pdfUrl } }",
  "variables": { "id": "{{tc_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.issueTC.status" == "issued"
jsonpath "$.data.issueTC.tcSerialNumber" != null
jsonpath "$.data.issueTC.pdfUrl" != null
