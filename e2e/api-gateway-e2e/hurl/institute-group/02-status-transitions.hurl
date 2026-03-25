# Auth: admin_token injected by auth-setup.sh
# ============================================================
# Institute Group Status Transitions
# Tests: deactivate, activate, suspend, and re-activate flows
# ============================================================

# Step 1: Create an institute group for status testing
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "mutation CreateInstituteGroup($input: CreateInstituteGroupInput!) { createInstituteGroup(input: $input) { id name code type status } }",
  "variables": {
    "input": {
      "name": "Chain Status Test",
      "code": "chain-status-e2e",
      "type": "CHAIN"
    }
  }
}
HTTP 200
[Captures]
group_id: jsonpath "$.data.createInstituteGroup.id"
[Asserts]
jsonpath "$.data.createInstituteGroup.id" != null
jsonpath "$.data.createInstituteGroup.status" == "ACTIVE"

# Step 2: Deactivate the group (ACTIVE -> INACTIVE)
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "mutation DeactivateInstituteGroup($id: ID!) { deactivateInstituteGroup(id: $id) { id status } }",
  "variables": { "id": "{{group_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.deactivateInstituteGroup.id" == {{group_id}}
jsonpath "$.data.deactivateInstituteGroup.status" == "INACTIVE"

# Step 3: Activate the group (INACTIVE -> ACTIVE)
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "mutation ActivateInstituteGroup($id: ID!) { activateInstituteGroup(id: $id) { id status } }",
  "variables": { "id": "{{group_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.activateInstituteGroup.id" == {{group_id}}
jsonpath "$.data.activateInstituteGroup.status" == "ACTIVE"

# Step 4: Suspend the group (ACTIVE -> SUSPENDED)
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "mutation SuspendInstituteGroup($id: ID!) { suspendInstituteGroup(id: $id) { id status } }",
  "variables": { "id": "{{group_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.suspendInstituteGroup.id" == {{group_id}}
jsonpath "$.data.suspendInstituteGroup.status" == "SUSPENDED"

# Step 5: Activate from suspended (SUSPENDED -> ACTIVE)
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "mutation ActivateInstituteGroup($id: ID!) { activateInstituteGroup(id: $id) { id status } }",
  "variables": { "id": "{{group_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.activateInstituteGroup.id" == {{group_id}}
jsonpath "$.data.activateInstituteGroup.status" == "ACTIVE"

# Step 6: Delete group (cleanup)
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "mutation DeleteInstituteGroup($id: ID!) { deleteInstituteGroup(id: $id) }",
  "variables": { "id": "{{group_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.deleteInstituteGroup" == true
