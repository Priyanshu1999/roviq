# ============================================================
# Create Student — admission number generation + profile creation
# Prereqs: institute login, academic year, standard, section exist
# ============================================================
# Auth: inst_token injected by auth-setup.sh

# Get active academic year + first standard + first section
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "query { standards { id name numericOrder } }"
}
HTTP 200
[Captures]
standard_id: jsonpath "$.data.standards[0].id"
[Asserts]
jsonpath "$.data.standards" count >= 1

POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "query($standardId: ID!) { sections(standardId: $standardId) { id name currentStrength } }",
  "variables": { "standardId": "{{standard_id}}" }
}
HTTP 200
[Captures]
section_id: jsonpath "$.data.sections[0].id"
initial_strength: jsonpath "$.data.sections[0].currentStrength"

# Step 4: Create student
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "mutation($input: CreateStudentInput!) { createStudent(input: $input) { id admissionNumber firstName academicStatus version } }",
  "variables": {
    "input": {
      "firstName": "Aarav",
      "lastName": "Sharma",
      "gender": "male",
      "dateOfBirth": "2015-06-15",
      "standardId": "{{standard_id}}",
      "sectionId": "{{section_id}}",
      "academicYearId": "{{academic_year_id}}",
      "socialCategory": "general"
    }
  }
}
HTTP 200
[Captures]
student_id: jsonpath "$.data.createStudent.id"
admission_number: jsonpath "$.data.createStudent.admissionNumber"
[Asserts]
jsonpath "$.data.createStudent.id" != null
jsonpath "$.data.createStudent.admissionNumber" != null
jsonpath "$.data.createStudent.firstName" == "Aarav"
jsonpath "$.data.createStudent.academicStatus" == "enrolled"
jsonpath "$.data.createStudent.version" == 1
