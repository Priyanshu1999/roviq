# ============================================================
# Create Staff Member — generates employee_id via tenant_sequences
# ============================================================
# Auth: inst_token injected by auth-setup.sh

# Create staff member
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "mutation CreateStaff($input: CreateStaffInput!) { createStaffMember(input: $input) { id employeeId designation department dateOfJoining employmentType } }",
  "variables": {
    "input": {
      "firstName": "Rajesh",
      "lastName": "Sharma",
      "gender": "male",
      "designation": "PGT Physics",
      "department": "Science",
      "dateOfJoining": "2025-04-01",
      "employmentType": "regular",
      "phone": "9876501001"
    }
  }
}
HTTP 200
[Captures]
staff_id: jsonpath "$.data.createStaffMember.id"
[Asserts]
jsonpath "$.data.createStaffMember.id" != null
jsonpath "$.data.createStaffMember.employeeId" != null
jsonpath "$.data.createStaffMember.designation" == "PGT Physics"
jsonpath "$.data.createStaffMember.department" == "Science"
jsonpath "$.data.createStaffMember.employmentType" == "regular"
