# ============================================================
# Create Static Group — manual member management
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

# Create static group
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "mutation($input: CreateGroupInput!) { createGroup(input: $input) { id name groupType membershipType status memberCount } }",
  "variables": {
    "input": {
      "name": "Chess Club",
      "groupType": "club",
      "membershipType": "static",
      "description": "Students interested in chess"
    }
  }
}
HTTP 200
[Captures]
group_id: jsonpath "$.data.createGroup.id"
[Asserts]
jsonpath "$.data.createGroup.name" == "Chess Club"
jsonpath "$.data.createGroup.groupType" == "club"
jsonpath "$.data.createGroup.membershipType" == "static"
jsonpath "$.data.createGroup.status" == "active"
jsonpath "$.data.createGroup.memberCount" == 0
