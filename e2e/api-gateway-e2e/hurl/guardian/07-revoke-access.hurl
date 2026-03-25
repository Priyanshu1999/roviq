# ============================================================
# Divorce Scenario — Revoke Guardian Access
# can_pickup=false, link preserved for TC history
# ============================================================
# Auth: inst_token injected by auth-setup.sh

# Revoke access — link preserved, can_pickup=false
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "mutation RevokeAccess($input: RevokeGuardianAccessInput!) { revokeGuardianAccess(input: $input) { id canPickup isPrimaryContact } }",
  "variables": {
    "input": {
      "guardianProfileId": "{{guardian_id}}",
      "studentProfileId": "{{student_profile_id}}",
      "reason": "Court order - custody change"
    }
  }
}
HTTP 200
[Asserts]
jsonpath "$.data.revokeGuardianAccess.canPickup" == false
jsonpath "$.data.revokeGuardianAccess.isPrimaryContact" == false
# Link ID still exists (not deleted)
jsonpath "$.data.revokeGuardianAccess.id" != null
