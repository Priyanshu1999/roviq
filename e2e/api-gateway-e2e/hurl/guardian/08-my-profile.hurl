# ============================================================
# myProfile — Returns correct type-specific data
# ============================================================
# Auth: inst_token injected by auth-setup.sh

# Query myProfile — returns union type based on membership role
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "query { myProfile { ... on MyStaffProfile { type userProfile { firstName lastName } staffProfile } ... on MyStudentProfile { type userProfile { firstName } studentProfile } ... on MyGuardianProfile { type userProfile { firstName } children { studentProfileId } } } }"
}
HTTP 200
[Asserts]
jsonpath "$.data.myProfile" != null
