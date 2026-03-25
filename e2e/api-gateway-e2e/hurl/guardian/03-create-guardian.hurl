# ============================================================
# Create Guardian + Link to Student
# ============================================================
# Auth: inst_token injected by auth-setup.sh

# Create guardian
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "mutation CreateGuardian($input: CreateGuardianInput!) { createGuardian(input: $input) { id occupation } }",
  "variables": {
    "input": {
      "firstName": "Suresh",
      "lastName": "Kumar",
      "phone": "9876502001",
      "occupation": "Government Officer"
    }
  }
}
HTTP 200
[Captures]
guardian_id: jsonpath "$.data.createGuardian.id"
[Asserts]
jsonpath "$.data.createGuardian.id" != null
jsonpath "$.data.createGuardian.occupation" == "Government Officer"
