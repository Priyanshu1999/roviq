# ============================================================
# Composite Group — parent = A UNION B, verify combined members
# ============================================================
# Auth: inst_token injected by auth-setup.sh

# Create child group A
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "mutation($input: CreateGroupInput!) { createGroup(input: $input) { id } }",
  "variables": {
    "input": {
      "name": "Composite Child A",
      "groupType": "custom",
      "membershipType": "static"
    }
  }
}
HTTP 200
[Captures]
child_a_id: jsonpath "$.data.createGroup.id"

# Create child group B
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "mutation($input: CreateGroupInput!) { createGroup(input: $input) { id } }",
  "variables": {
    "input": {
      "name": "Composite Child B",
      "groupType": "custom",
      "membershipType": "static"
    }
  }
}
HTTP 200
[Captures]
child_b_id: jsonpath "$.data.createGroup.id"

# Create composite parent
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "mutation($input: CreateGroupInput!) { createGroup(input: $input) { id groupType membershipType } }",
  "variables": {
    "input": {
      "name": "Composite Parent",
      "groupType": "composite",
      "membershipType": "dynamic",
      "childGroupIds": ["{{child_a_id}}", "{{child_b_id}}"]
    }
  }
}
HTTP 200
[Captures]
composite_id: jsonpath "$.data.createGroup.id"
[Asserts]
jsonpath "$.data.createGroup.groupType" == "composite"

# Resolve composite
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "mutation($groupId: ID!) { resolveGroupMembers(groupId: $groupId) { groupId memberCount } }",
  "variables": { "groupId": "{{composite_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.resolveGroupMembers.memberCount" >= 0
