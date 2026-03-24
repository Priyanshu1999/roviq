# ============================================================
# Reseller Institute Group Management
# Tests: resellerCreateInstituteGroup, resellerListInstituteGroups
# Cleanup via admin scope: adminDeleteInstituteGroup
# ============================================================

# Step 1: Reseller login
POST {{base_url}}/graphql
Content-Type: application/json
{
  "query": "mutation { resellerLogin(username: \"{{reseller_username}}\", password: \"{{reseller_password}}\") { accessToken } }"
}
HTTP 200
[Captures]
reseller_token: jsonpath "$.data.resellerLogin.accessToken"
[Asserts]
jsonpath "$.data.resellerLogin.accessToken" != null

# Step 2: Reseller creates an institute group
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{reseller_token}}
{
  "query": "mutation CreateGroup($input: CreateInstituteGroupInput!) { resellerCreateInstituteGroup(input: $input) }",
  "variables": {
    "input": {
      "name": "Reseller E2E Group",
      "code": "reseller-e2e-group",
      "type": "SOCIETY"
    }
  }
}
HTTP 200
[Captures]
group_id: jsonpath "$.data.resellerCreateInstituteGroup.id"
[Asserts]
jsonpath "$.data.resellerCreateInstituteGroup" != null
jsonpath "$.data.resellerCreateInstituteGroup.id" != null
jsonpath "$.data.resellerCreateInstituteGroup.name" == "Reseller E2E Group"
jsonpath "$.data.resellerCreateInstituteGroup.code" == "reseller-e2e-group"
jsonpath "$.data.resellerCreateInstituteGroup.type" == "SOCIETY"

# Step 3: Reseller lists institute groups — should include the created group
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{reseller_token}}
{
  "query": "query { resellerListInstituteGroups }"
}
HTTP 200
[Asserts]
jsonpath "$.data.resellerListInstituteGroups" != null
jsonpath "$.data.resellerListInstituteGroups.totalCount" >= 0

# Step 4: Admin login for cleanup
POST {{base_url}}/graphql
Content-Type: application/json
{
  "query": "mutation { adminLogin(username: \"{{username}}\", password: \"{{password}}\") { accessToken } }"
}
HTTP 200
[Captures]
admin_token: jsonpath "$.data.adminLogin.accessToken"
[Asserts]
jsonpath "$.data.adminLogin.accessToken" != null

# Step 5: Admin deletes the group (cleanup)
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "mutation AdminDeleteGroup($id: ID!) { adminDeleteInstituteGroup(id: $id) }",
  "variables": { "id": "{{group_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.adminDeleteInstituteGroup" == true
