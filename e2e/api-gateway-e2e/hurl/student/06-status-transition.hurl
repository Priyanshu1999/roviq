# ============================================================
# Status Transitions — valid + invalid
# ============================================================
# Auth: inst_token injected by auth-setup.sh

# Get a student
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "query { listStudents(filter: { first: 1, academicStatus: \"enrolled\" }) { edges { node { id version } } } }"
}
HTTP 200
[Captures]
student_id: jsonpath "$.data.listStudents.edges[0].node.id"
version: jsonpath "$.data.listStudents.edges[0].node.version"

# Valid transition: enrolled → suspended
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "mutation($id: ID!, $input: UpdateStudentInput!) { updateStudent(id: $id, input: $input) { id academicStatus version } }",
  "variables": {
    "id": "{{student_id}}",
    "input": { "version": {{version}}, "academicStatus": "suspended" }
  }
}
HTTP 200
[Captures]
new_version: jsonpath "$.data.updateStudent.version"
[Asserts]
jsonpath "$.data.updateStudent.academicStatus" == "suspended"

# Invalid transition: suspended → graduated (not allowed)
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "mutation($id: ID!, $input: UpdateStudentInput!) { updateStudent(id: $id, input: $input) { id } }",
  "variables": {
    "id": "{{student_id}}",
    "input": { "version": {{new_version}}, "academicStatus": "graduated" }
  }
}
HTTP 200
[Asserts]
jsonpath "$.errors[0].message" contains "Invalid status transition"

# Valid transition: suspended → enrolled (reinstated)
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "mutation($id: ID!, $input: UpdateStudentInput!) { updateStudent(id: $id, input: $input) { id academicStatus } }",
  "variables": {
    "id": "{{student_id}}",
    "input": { "version": {{new_version}}, "academicStatus": "enrolled" }
  }
}
HTTP 200
[Asserts]
jsonpath "$.data.updateStudent.academicStatus" == "enrolled"
