# ============================================================
# Create Dynamic Group — rule-based, resolve, verify member count
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

# Create dynamic group with rule: all enrolled students
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "mutation($input: CreateGroupInput!) { createGroup(input: $input) { id name membershipType memberCount resolvedAt } }",
  "variables": {
    "input": {
      "name": "All Enrolled Students",
      "groupType": "custom",
      "membershipType": "dynamic",
      "rule": { "==": [{ "var": "academic_status" }, "enrolled"] },
      "ruleDescription": "All students with academic_status = enrolled"
    }
  }
}
HTTP 200
[Captures]
dynamic_group_id: jsonpath "$.data.createGroup.id"
[Asserts]
jsonpath "$.data.createGroup.membershipType" == "dynamic"
jsonpath "$.data.createGroup.memberCount" == 0

# Resolve members
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "mutation($groupId: ID!) { resolveGroupMembers(groupId: $groupId) { groupId memberCount resolvedAt } }",
  "variables": { "groupId": "{{dynamic_group_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.resolveGroupMembers.groupId" == "{{dynamic_group_id}}"
jsonpath "$.data.resolveGroupMembers.memberCount" >= 0
jsonpath "$.data.resolveGroupMembers.resolvedAt" != null
