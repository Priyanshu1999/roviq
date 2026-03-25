# ============================================================
# Soft Delete — student invisible in list after deletion
# ============================================================
# Auth: inst_token injected by auth-setup.sh

# Create a student to delete (isolated test data)
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
  "query": "query($standardId: ID!) { sections(standardId: $standardId) { id } }",
  "variables": { "standardId": "{{standard_id}}" }
}
HTTP 200
[Captures]
section_id: jsonpath "$.data.sections[0].id"

POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "mutation($input: CreateStudentInput!) { createStudent(input: $input) { id admissionNumber } }",
  "variables": {
    "input": {
      "firstName": "DeleteTest",
      "lastName": "Student",
      "gender": "female",
      "dateOfBirth": "2016-01-01",
      "standardId": "{{standard_id}}",
      "sectionId": "{{section_id}}",
      "academicYearId": "{{academic_year_id}}"
    }
  }
}
HTTP 200
[Captures]
delete_student_id: jsonpath "$.data.createStudent.id"

# Count before delete
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "query { listStudents { totalCount } }"
}
HTTP 200
[Captures]
count_before: jsonpath "$.data.listStudents.totalCount"

# Soft delete
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "mutation($id: ID!) { deleteStudent(id: $id) }",
  "variables": { "id": "{{delete_student_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.deleteStudent" == true

# Count after — should be one less
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "query { listStudents { totalCount } }"
}
HTTP 200
[Asserts]
jsonpath "$.data.listStudents.totalCount" < {{count_before}}

# Get by ID — should 404
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "query($id: ID!) { getStudent(id: $id) { id } }",
  "variables": { "id": "{{delete_student_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.errors[0]" != null
