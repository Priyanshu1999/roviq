# ============================================================
# Dedup Enquiry — same phone+class → isDuplicate warning
# ============================================================
# Auth: inst_token injected by auth-setup.sh

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
