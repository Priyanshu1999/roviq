# ============================================================
# Section Change — old section decremented, new incremented
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

# Get standard with at least 2 sections
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "query { standards { id } }"
}
HTTP 200
[Captures]
standard_id: jsonpath "$.data.standards[0].id"

POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "query($standardId: ID!) { sections(standardId: $standardId) { id name currentStrength } }",
  "variables": { "standardId": "{{standard_id}}" }
}
HTTP 200
[Captures]
old_section_id: jsonpath "$.data.sections[0].id"
old_strength: jsonpath "$.data.sections[0].currentStrength"
new_section_id: jsonpath "$.data.sections[1].id"
new_strength: jsonpath "$.data.sections[1].currentStrength"
[Asserts]
jsonpath "$.data.sections" count >= 2

# Get a student academic record in the old section
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "query($filter: StudentFilterInput) { listStudents(filter: $filter) { edges { node { id } } } }",
  "variables": { "filter": { "sectionId": "{{old_section_id}}", "first": 1 } }
}
HTTP 200
[Captures]
student_id: jsonpath "$.data.listStudents.edges[0].node.id"

# Change section
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "mutation($input: UpdateStudentSectionInput!) { updateStudentSection(input: $input) }",
  "variables": {
    "input": {
      "studentAcademicId": "{{student_academic_id}}",
      "newSectionId": "{{new_section_id}}"
    }
  }
}
HTTP 200
[Asserts]
jsonpath "$.data.updateStudentSection" != null
