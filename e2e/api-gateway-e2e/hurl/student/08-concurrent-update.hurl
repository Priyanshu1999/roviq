# ============================================================
# Concurrent Update — two updates with same version → one 409
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

# Get student with current version
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "query { listStudents(filter: { first: 1 }) { edges { node { id version } } } }"
}
HTTP 200
[Captures]
student_id: jsonpath "$.data.listStudents.edges[0].node.id"
version: jsonpath "$.data.listStudents.edges[0].node.version"

# First update succeeds
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "mutation($id: ID!, $input: UpdateStudentInput!) { updateStudent(id: $id, input: $input) { id version } }",
  "variables": {
    "id": "{{student_id}}",
    "input": { "version": {{version}}, "caste": "Rajput" }
  }
}
HTTP 200
[Asserts]
jsonpath "$.data.updateStudent.version" > {{version}}

# Second update with SAME old version → CONCURRENT_MODIFICATION error
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "mutation($id: ID!, $input: UpdateStudentInput!) { updateStudent(id: $id, input: $input) { id version } }",
  "variables": {
    "id": "{{student_id}}",
    "input": { "version": {{version}}, "caste": "Verma" }
  }
}
HTTP 200
[Asserts]
jsonpath "$.errors[0].message" contains "Concurrent modification"
