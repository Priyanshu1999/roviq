# ============================================================
# Admission Statistics — funnel counts
# ============================================================
# Auth: inst_token injected by auth-setup.sh

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
