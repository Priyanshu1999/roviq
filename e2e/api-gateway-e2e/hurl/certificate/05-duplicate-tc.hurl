# ============================================================
# Duplicate TC — request with original_tc_id, is_duplicate=true
# ============================================================
# Auth: inst_token injected by auth-setup.sh

POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "mutation DupTC($input: RequestDuplicateTCInput!) { requestDuplicateTC(input: $input) { id isDuplicate originalTcId status } }",
  "variables": {
    "input": {
      "originalTcId": "{{tc_id}}",
      "reason": "Original TC lost — FIR filed on 2026-03-20"
    }
  }
}
HTTP 200
[Asserts]
jsonpath "$.data.requestDuplicateTC.isDuplicate" == true
jsonpath "$.data.requestDuplicateTC.originalTcId" == "{{tc_id}}"
jsonpath "$.data.requestDuplicateTC.status" == "duplicate_requested"
