# ============================================================
# Request TC → status=requested, workflow starts
# ============================================================
# Auth: inst_token injected by auth-setup.sh

POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "mutation RequestTC($input: RequestTCInput!) { requestTC(input: $input) { id status reason tcSerialNumber } }",
  "variables": {
    "input": {
      "studentProfileId": "{{student_profile_id}}",
      "academicYearId": "{{academic_year_id}}",
      "reason": "Transfer to another city"
    }
  }
}
HTTP 200
[Captures]
tc_id: jsonpath "$.data.requestTC.id"
[Asserts]
jsonpath "$.data.requestTC.id" != null
jsonpath "$.data.requestTC.status" == "requested"
jsonpath "$.data.requestTC.reason" == "Transfer to another city"
