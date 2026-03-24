# ============================================================
# Admin Create Institute
# Tests: adminCreateInstitute mutation — minimal fields, all fields,
#        and duplicate slug error handling
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

# Step 2: Create institute with minimal required fields
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation AdminCreateInstitute($input: AdminCreateInstituteInput!) { adminCreateInstitute(input: $input) { id name slug type structureFramework setupStatus status timezone currency contact settings } }",
  "variables": {
    "input": {
      "name": { "en": "Hurl Test Institute" },
      "slug": "hurl-test-institute",
      "type": "SCHOOL"
    }
  }
}
HTTP 200
[Captures]
institute_id: jsonpath "$.data.adminCreateInstitute.id"
[Asserts]
jsonpath "$.data.adminCreateInstitute.id" != null
jsonpath "$.data.adminCreateInstitute.name.en" == "Hurl Test Institute"
jsonpath "$.data.adminCreateInstitute.slug" == "hurl-test-institute"
jsonpath "$.data.adminCreateInstitute.type" == "SCHOOL"
jsonpath "$.data.adminCreateInstitute.status" == "PENDING"
jsonpath "$.data.adminCreateInstitute.setupStatus" != null

# Step 3: Create institute with all fields
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation AdminCreateInstitute($input: AdminCreateInstituteInput!) { adminCreateInstitute(input: $input) { id name slug type structureFramework setupStatus status timezone currency contact settings } }",
  "variables": {
    "input": {
      "name": { "en": "Hurl Coaching Institute" },
      "slug": "hurl-coaching",
      "type": "COACHING",
      "structureFramework": "NEP",
      "code": "COACH-001",
      "contact": { "email": "test@roviq.com", "phone": "+919999999999" },
      "departments": ["PRIMARY", "SECONDARY"],
      "isDemo": true
    }
  }
}
HTTP 200
[Captures]
coaching_id: jsonpath "$.data.adminCreateInstitute.id"
[Asserts]
jsonpath "$.data.adminCreateInstitute.id" != null
jsonpath "$.data.adminCreateInstitute.name.en" == "Hurl Coaching Institute"
jsonpath "$.data.adminCreateInstitute.slug" == "hurl-coaching"
jsonpath "$.data.adminCreateInstitute.type" == "COACHING"
jsonpath "$.data.adminCreateInstitute.structureFramework" == "NEP"
jsonpath "$.data.adminCreateInstitute.setupStatus" != null
jsonpath "$.data.adminCreateInstitute.status" == "PENDING"

# Step 4: Create with duplicate slug — expect errors
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation AdminCreateInstitute($input: AdminCreateInstituteInput!) { adminCreateInstitute(input: $input) { id slug } }",
  "variables": {
    "input": {
      "name": { "en": "Duplicate Slug Institute" },
      "slug": "hurl-test-institute",
      "type": "SCHOOL"
    }
  }
}
HTTP 200
[Asserts]
jsonpath "$.errors" not isEmpty

# Step 5: Cleanup — delete created institutes
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

POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation AdminDeleteInstitute($id: ID!) { adminDeleteInstitute(id: $id) }",
  "variables": { "id": "{{coaching_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.adminDeleteInstitute" == true
