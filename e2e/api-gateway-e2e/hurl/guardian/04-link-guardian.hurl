# ============================================================
# Link Existing Guardian to Student
# ============================================================
# Auth: inst_token injected by auth-setup.sh

# Link guardian to student — requires pre-existing guardian_id and student_profile_id
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "mutation LinkGuardian($input: LinkGuardianInput!) { linkGuardianToStudent(input: $input) { id relationship isPrimaryContact canPickup } }",
  "variables": {
    "input": {
      "guardianProfileId": "{{guardian_id}}",
      "studentProfileId": "{{student_profile_id}}",
      "relationship": "father",
      "isPrimaryContact": true,
      "canPickup": true
    }
  }
}
HTTP 200
[Asserts]
jsonpath "$.data.linkGuardianToStudent.id" != null
jsonpath "$.data.linkGuardianToStudent.relationship" == "father"
jsonpath "$.data.linkGuardianToStudent.isPrimaryContact" == true
