# ============================================================
# Bonafide Certificate — request + issue from template
# ============================================================

POST {{base_url}}/graphql
Content-Type: application/json
{
  "query": "mutation { instituteLogin(username: \"{{username}}\", password: \"{{password}}\") { requiresInstituteSelection selectionToken memberships { membershipId } } }"
}
HTTP 200
[Captures]
membership_id: jsonpath "$.data.instituteLogin.memberships[0].membershipId"
selection_token: jsonpath "$.data.instituteLogin.selectionToken"

POST {{base_url}}/graphql
Content-Type: application/json
{
  "query": "mutation SelectInstitute($t: String!, $m: String!) { selectInstitute(selectionToken: $t, membershipId: $m) { accessToken } }",
  "variables": { "t": "{{selection_token}}", "m": "{{membership_id}}" }
}
HTTP 200
[Captures]
access_token: jsonpath "$.data.selectInstitute.accessToken"

# Request bonafide certificate
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation ReqCert($input: RequestCertificateInput!) { requestCertificate(input: $input) { id serialNumber status certificateData } }",
  "variables": {
    "input": {
      "templateId": "{{bonafide_template_id}}",
      "studentProfileId": "{{student_profile_id}}",
      "purpose": "For scholarship application"
    }
  }
}
HTTP 200
[Captures]
cert_id: jsonpath "$.data.requestCertificate.id"
[Asserts]
jsonpath "$.data.requestCertificate.id" != null
jsonpath "$.data.requestCertificate.serialNumber" != null

# Issue the certificate
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation IssueCert($id: ID!) { issueCertificate(id: $id) { id status pdfUrl } }",
  "variables": { "id": "{{cert_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.issueCertificate.status" == "issued"
jsonpath "$.data.issueCertificate.pdfUrl" != null
