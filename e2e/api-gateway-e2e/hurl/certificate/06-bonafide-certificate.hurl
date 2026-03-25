# ============================================================
# Bonafide Certificate — request + issue from template
# ============================================================
# Auth: inst_token injected by auth-setup.sh

# Request bonafide certificate
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
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
Authorization: Bearer {{inst_token}}
{
  "query": "mutation IssueCert($id: ID!) { issueCertificate(id: $id) { id status pdfUrl } }",
  "variables": { "id": "{{cert_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.issueCertificate.status" == "issued"
jsonpath "$.data.issueCertificate.pdfUrl" != null
