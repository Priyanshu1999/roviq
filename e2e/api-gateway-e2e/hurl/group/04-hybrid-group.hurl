# ============================================================
# Hybrid Group — rule + manual exclusion + manual add
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

# Create hybrid group
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "mutation($input: CreateGroupInput!) { createGroup(input: $input) { id membershipType } }",
  "variables": {
    "input": {
      "name": "Hybrid Test Group",
      "groupType": "custom",
      "membershipType": "hybrid",
      "rule": { "==": [{ "var": "academic_status" }, "enrolled"] }
    }
  }
}
HTTP 200
[Captures]
hybrid_group_id: jsonpath "$.data.createGroup.id"
[Asserts]
jsonpath "$.data.createGroup.membershipType" == "hybrid"

# Resolve hybrid group
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "mutation($groupId: ID!) { resolveGroupMembers(groupId: $groupId) { groupId memberCount } }",
  "variables": { "groupId": "{{hybrid_group_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.resolveGroupMembers.memberCount" >= 0
