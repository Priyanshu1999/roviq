# ============================================================
# Create Enquiry — phone validation, auto-dedup, response
# ============================================================
# Auth: inst_token injected by auth-setup.sh

# Create enquiry
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
