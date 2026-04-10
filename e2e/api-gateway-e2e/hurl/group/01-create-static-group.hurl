# ============================================================
# Create Static Group — manual member management
# ============================================================
# Auth: inst_token injected by auth-setup.sh

# Create static group
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "mutation($input: CreateGroupInput!) { createGroup(input: $input) { id name groupType membershipType status memberCount } }",
  "variables": {
    "input": {
      "name": "Chess Club",
      "groupType": "CLUB",
      "membershipType": "STATIC",
      "description": "Students interested in chess"
    }
  }
}
HTTP 200
[Captures]
group_id: jsonpath "$.data.createGroup.id"
[Asserts]
jsonpath "$.data.createGroup.name" == "Chess Club"
jsonpath "$.data.createGroup.groupType" == "CLUB"
jsonpath "$.data.createGroup.membershipType" == "STATIC"
jsonpath "$.data.createGroup.status" == "active"
jsonpath "$.data.createGroup.memberCount" == 0
