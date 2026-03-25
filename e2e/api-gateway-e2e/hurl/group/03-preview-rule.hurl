# ============================================================
# Preview Rule — dry-run returns count without saving
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

# Preview a rule (dry-run — does NOT create a group)
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "query($rule: JSON!) { previewGroupRule(rule: $rule) { count sampleMembershipIds } }",
  "variables": {
    "rule": { "==": [{ "var": "academic_status" }, "enrolled"] }
  }
}
HTTP 200
[Asserts]
jsonpath "$.data.previewGroupRule.count" >= 0
jsonpath "$.data.previewGroupRule.sampleMembershipIds" isCollection
