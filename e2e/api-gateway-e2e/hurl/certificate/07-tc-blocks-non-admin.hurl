# ============================================================
# TC blocks non-admin — teacher cannot request TC → 403/error
# ============================================================
# Auth: teacher_token injected by auth-setup.sh
# Tests that a teacher role is denied by CASL for TC requests.

# Attempt TC request as teacher → should be denied by CASL
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{teacher_token}}
{
  "query": "mutation RequestTC($input: RequestTCInput!) { requestTC(input: $input) { id status } }",
  "variables": {
    "input": {
      "studentProfileId": "{{student_profile_id}}",
      "academicYearId": "{{academic_year_id}}",
      "reason": "Unauthorized attempt"
    }
  }
}
HTTP 200
[Asserts]
jsonpath "$.errors" != null
jsonpath "$.errors[0].message" contains "Forbidden"
