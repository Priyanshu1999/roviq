# ============================================================
# Sibling Discovery — myChildren returns all linked students
# ============================================================
# Auth: inst_token injected by auth-setup.sh

# Query myChildren (as a guardian)
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "query { myChildren { ... on MyGuardianProfile { type children { studentProfileId relationship isPrimaryContact firstName } } } }"
}
HTTP 200
[Asserts]
jsonpath "$.data.myChildren" != null
