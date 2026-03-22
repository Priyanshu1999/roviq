# ============================================================
# Create Institute
# Tests: createInstitute mutation — minimal fields, all fields,
#        and duplicate slug error handling
# ============================================================

# Step 1: Institute login
POST {{base_url}}/graphql
Content-Type: application/json
{
  "query": "mutation { instituteLogin(username: \"{{username}}\", password: \"{{password}}\") { requiresInstituteSelection selectionToken userId memberships { membershipId tenantId } } }"
}
HTTP 200
[Captures]
membership_id: jsonpath "$.data.instituteLogin.memberships[0].membershipId"
selection_token: jsonpath "$.data.instituteLogin.selectionToken"
user_id: jsonpath "$.data.instituteLogin.userId"
tenant_id: jsonpath "$.data.instituteLogin.memberships[0].tenantId"
[Asserts]
jsonpath "$.data.instituteLogin.requiresInstituteSelection" == true

# Step 2: Select institute → get accessToken
POST {{base_url}}/graphql
Content-Type: application/json
{
  "query": "mutation SelectInstitute($selectionToken: String!, $membershipId: String!) { selectInstitute(selectionToken: $selectionToken, membershipId: $membershipId) { accessToken } }",
  "variables": { "selectionToken": "{{selection_token}}", "membershipId": "{{membership_id}}" }
}
HTTP 200
[Captures]
access_token: jsonpath "$.data.selectInstitute.accessToken"
[Asserts]
jsonpath "$.data.selectInstitute.accessToken" != null

# Step 3: Create institute with minimal required fields
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation CreateInstitute($input: CreateInstituteInput!) { createInstitute(input: $input) { id name slug type structureFramework setupStatus status timezone currency contact settings } }",
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
institute_id: jsonpath "$.data.createInstitute.id"
[Asserts]
jsonpath "$.data.createInstitute.id" != null
jsonpath "$.data.createInstitute.name.en" == "Hurl Test Institute"
jsonpath "$.data.createInstitute.slug" == "hurl-test-institute"
jsonpath "$.data.createInstitute.type" == "SCHOOL"
jsonpath "$.data.createInstitute.status" == "PENDING"
jsonpath "$.data.createInstitute.setupStatus" != null

# Step 4: Create institute with all fields
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation CreateInstitute($input: CreateInstituteInput!) { createInstitute(input: $input) { id name slug type structureFramework setupStatus status timezone currency contact settings } }",
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
[Asserts]
jsonpath "$.data.createInstitute.id" != null
jsonpath "$.data.createInstitute.name.en" == "Hurl Coaching Institute"
jsonpath "$.data.createInstitute.slug" == "hurl-coaching"
jsonpath "$.data.createInstitute.type" == "COACHING"
jsonpath "$.data.createInstitute.structureFramework" == "NEP"
jsonpath "$.data.createInstitute.setupStatus" != null
jsonpath "$.data.createInstitute.status" == "PENDING"

# Step 5: Create with duplicate slug — expect errors
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation CreateInstitute($input: CreateInstituteInput!) { createInstitute(input: $input) { id slug } }",
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
