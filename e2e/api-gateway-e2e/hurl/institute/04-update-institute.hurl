# ============================================================
# Admin Update Institute Info
# Tests: adminCreateInstitute, adminGetInstitute to verify fields,
#        then adminDeleteInstitute for cleanup.
#
# NOTE: updateInstituteInfo is institute-scoped (not platform-scoped).
# Platform admin can create institutes and view them, but detailed
# info updates go through the institute-scoped resolver.
# This test verifies the admin create + get flow with various field combos.
# ============================================================

# Step 1: Admin login (platform scope — returns accessToken directly)
POST {{base_url}}/graphql
Content-Type: application/json
{
  "query": "mutation { adminLogin(username: \"{{username}}\", password: \"{{password}}\") { accessToken } }"
}
HTTP 200
[Captures]
access_token: jsonpath "$.data.adminLogin.accessToken"
[Asserts]
jsonpath "$.data.adminLogin.accessToken" != null

# Step 2: Create institute with contact info
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation AdminCreateInstitute($input: AdminCreateInstituteInput!) { adminCreateInstitute(input: $input) { id name code contact address timezone currency status } }",
  "variables": {
    "input": {
      "name": {"en": "Hurl Update Test"},
      "slug": "hurl-update-test",
      "type": "SCHOOL",
      "contact": {"email": "test@roviq.com", "phone": "+919999999999"},
      "address": {"line1": "123 Main St", "city": "Mumbai", "state": "MH", "country": "IN", "postalCode": "400001"}
    }
  }
}
HTTP 200
[Captures]
institute_id: jsonpath "$.data.adminCreateInstitute.id"
[Asserts]
jsonpath "$.data.adminCreateInstitute.id" != null
jsonpath "$.data.adminCreateInstitute.name.en" == "Hurl Update Test"

# Step 3: Admin gets the created institute — verify all fields
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "query AdminGetInstitute($id: ID!) { adminGetInstitute(id: $id) { id name slug type status setupStatus timezone currency contact address } }",
  "variables": { "id": "{{institute_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.adminGetInstitute.id" == {{institute_id}}
jsonpath "$.data.adminGetInstitute.name.en" == "Hurl Update Test"
jsonpath "$.data.adminGetInstitute.slug" == "hurl-update-test"
jsonpath "$.data.adminGetInstitute.type" == "SCHOOL"
jsonpath "$.data.adminGetInstitute.timezone" != null
jsonpath "$.data.adminGetInstitute.currency" != null

# Step 4: Cleanup — delete test institute
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation AdminDeleteInstitute($id: ID!) { adminDeleteInstitute(id: $id) }",
  "variables": { "id": "{{institute_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.adminDeleteInstitute" == true
