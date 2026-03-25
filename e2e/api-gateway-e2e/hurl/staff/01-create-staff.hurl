# ============================================================
# Create Staff Member — generates employee_id via tenant_sequences
# ============================================================

# Step 1: Institute login
POST {{base_url}}/graphql
Content-Type: application/json
{
  "query": "mutation { instituteLogin(username: \"{{username}}\", password: \"{{password}}\") { requiresInstituteSelection selectionToken memberships { membershipId tenantId } } }"
}
HTTP 200
[Captures]
membership_id: jsonpath "$.data.instituteLogin.memberships[0].membershipId"
selection_token: jsonpath "$.data.instituteLogin.selectionToken"

# Step 2: Select institute
POST {{base_url}}/graphql
Content-Type: application/json
{
  "query": "mutation SelectInstitute($selectionToken: String!, $membershipId: String!) { selectInstitute(selectionToken: $selectionToken, membershipId: $membershipId) { accessToken } }",
  "variables": { "selectionToken": "{{selection_token}}", "membershipId": "{{membership_id}}" }
}
HTTP 200
[Captures]
access_token: jsonpath "$.data.selectInstitute.accessToken"
[Asserts]
jsonpath "$.data.selectInstitute.accessToken" != null

# Step 3: Create staff member
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
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
