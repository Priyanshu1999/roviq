# ============================================================
# Update Student — optimistic concurrency (version increments)
# Depends on: student exists from previous test
# ============================================================
# Auth: inst_token injected by auth-setup.sh

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
