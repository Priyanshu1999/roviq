# ============================================================
# Update Student — optimistic concurrency (version increments)
# Depends on: student exists from previous test
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

# Get a student to update
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "query { listStudents(filter: { first: 1 }) { edges { node { id version } } } }"
}
HTTP 200
[Captures]
student_id: jsonpath "$.data.listStudents.edges[0].node.id"
current_version: jsonpath "$.data.listStudents.edges[0].node.version"

# Update social category — version should increment
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "mutation($id: ID!, $input: UpdateStudentInput!) { updateStudent(id: $id, input: $input) { id version socialCategory } }",
  "variables": {
    "id": "{{student_id}}",
    "input": { "version": {{current_version}}, "socialCategory": "obc" }
  }
}
HTTP 200
[Asserts]
jsonpath "$.data.updateStudent.socialCategory" == "obc"
jsonpath "$.data.updateStudent.version" > {{current_version}}
