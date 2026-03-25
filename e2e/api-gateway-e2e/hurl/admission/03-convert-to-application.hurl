# ============================================================
# Convert Enquiry → Application
# ============================================================

POST {{base_url}}/graphql
Content-Type: application/json
{
  "query": "mutation { instituteLogin(username: \"{{username}}\", password: \"{{password}}\") { accessToken } }"
}
HTTP 200
[Captures]
access_token: jsonpath "$.data.instituteLogin.accessToken"

POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation { selectInstitute(membershipId: \"{{admin_membership_id}}\") { accessToken } }"
}
HTTP 200
[Captures]
inst_token: jsonpath "$.data.selectInstitute.accessToken"

# Create a fresh enquiry
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "mutation($input: CreateEnquiryInput!) { createEnquiry(input: $input) { id } }",
  "variables": {
    "input": {
      "studentName": "Convert Test",
      "parentName": "Parent Test",
      "parentPhone": "9123456789",
      "classRequested": "Class 1"
    }
  }
}
HTTP 200
[Captures]
enquiry_id: jsonpath "$.data.createEnquiry.id"

# Get standard ID for conversion
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "query { standards { id name } }"
}
HTTP 200
[Captures]
standard_id: jsonpath "$.data.standards[0].id"

# Convert enquiry to application
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "mutation($enquiryId: ID!, $standardId: ID!, $academicYearId: ID!) { convertEnquiryToApplication(enquiryId: $enquiryId, standardId: $standardId, academicYearId: $academicYearId) { id status enquiryId formData } }",
  "variables": {
    "enquiryId": "{{enquiry_id}}",
    "standardId": "{{standard_id}}",
    "academicYearId": "{{academic_year_id}}"
  }
}
HTTP 200
[Captures]
application_id: jsonpath "$.data.convertEnquiryToApplication.id"
[Asserts]
jsonpath "$.data.convertEnquiryToApplication.id" != null
jsonpath "$.data.convertEnquiryToApplication.status" == "submitted"
jsonpath "$.data.convertEnquiryToApplication.enquiryId" == "{{enquiry_id}}"
