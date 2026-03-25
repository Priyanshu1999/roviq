# ============================================================
# Dedup Enquiry — same phone+class → isDuplicate warning
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

# First enquiry — not duplicate
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "mutation($input: CreateEnquiryInput!) { createEnquiry(input: $input) { id isDuplicate } }",
  "variables": {
    "input": {
      "studentName": "Dedup Child",
      "parentName": "Dedup Parent",
      "parentPhone": "9444555666",
      "classRequested": "LKG"
    }
  }
}
HTTP 200
[Asserts]
jsonpath "$.data.createEnquiry.isDuplicate" == false

# Second enquiry with SAME phone + class → isDuplicate = true (warning, not error)
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "mutation($input: CreateEnquiryInput!) { createEnquiry(input: $input) { id isDuplicate } }",
  "variables": {
    "input": {
      "studentName": "Dedup Child 2",
      "parentName": "Dedup Parent",
      "parentPhone": "9444555666",
      "classRequested": "LKG"
    }
  }
}
HTTP 200
[Asserts]
jsonpath "$.data.createEnquiry.isDuplicate" == true
jsonpath "$.data.createEnquiry.id" != null
