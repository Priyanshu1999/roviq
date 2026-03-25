# ============================================================
# Admission Statistics — funnel counts
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

# Get statistics
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "query { admissionStatistics { totalEnquiries totalApplications funnel { stage count } bySource { source enquiryCount } enquiryToApplicationRate applicationToEnrolledRate } }"
}
HTTP 200
[Asserts]
jsonpath "$.data.admissionStatistics.totalEnquiries" >= 0
jsonpath "$.data.admissionStatistics.totalApplications" >= 0
jsonpath "$.data.admissionStatistics.funnel" count >= 1
jsonpath "$.data.admissionStatistics.enquiryToApplicationRate" >= 0
jsonpath "$.data.admissionStatistics.applicationToEnrolledRate" >= 0
