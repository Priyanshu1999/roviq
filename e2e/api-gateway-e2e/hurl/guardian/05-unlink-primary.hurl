# ============================================================
# Unlink Primary Guardian Without Replacement → Error
# ============================================================
# Auth: inst_token injected by auth-setup.sh

# Attempt to unlink primary contact without newPrimaryGuardianId → expect error
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "mutation UnlinkGuardian($input: UnlinkGuardianInput!) { unlinkGuardianFromStudent(input: $input) }",
  "variables": {
    "input": {
      "guardianProfileId": "{{guardian_id}}",
      "studentProfileId": "{{student_profile_id}}"
    }
  }
}
HTTP 200
[Asserts]
jsonpath "$.errors" != null
jsonpath "$.errors[0].message" contains "primary"
