# ============================================================
# Create Enquiry — phone validation, auto-dedup, response
# ============================================================

# Step 1: Institute login
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

# Step 2: Create enquiry
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "mutation($input: CreateEnquiryInput!) { createEnquiry(input: $input) { id studentName parentName parentPhone classRequested source status isDuplicate createdAt } }",
  "variables": {
    "input": {
      "studentName": "Priya Sharma",
      "parentName": "Rajesh Sharma",
      "parentPhone": "9876543210",
      "classRequested": "Nursery",
      "source": "walk_in",
      "gender": "female",
      "dateOfBirth": "2020-03-15"
    }
  }
}
HTTP 200
[Captures]
enquiry_id: jsonpath "$.data.createEnquiry.id"
[Asserts]
jsonpath "$.data.createEnquiry.id" != null
jsonpath "$.data.createEnquiry.studentName" == "Priya Sharma"
jsonpath "$.data.createEnquiry.parentPhone" == "9876543210"
jsonpath "$.data.createEnquiry.status" == "new"
jsonpath "$.data.createEnquiry.source" == "walk_in"
jsonpath "$.data.createEnquiry.isDuplicate" == false
