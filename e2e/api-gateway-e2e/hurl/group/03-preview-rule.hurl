# ============================================================
# Preview Rule — dry-run returns count without saving
# ============================================================
# Auth: inst_token injected by auth-setup.sh

# Preview a rule (dry-run — does NOT create a group)
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "query($rule: JSON!) { previewGroupRule(rule: $rule) { count sampleMembershipIds } }",
  "variables": {
    "rule": { "==": [{ "var": "academic_status" }, "ENROLLED"] }
  }
}
HTTP 200
[Asserts]
jsonpath "$.data.previewGroupRule.count" >= 0
jsonpath "$.data.previewGroupRule.sampleMembershipIds" isCollection
