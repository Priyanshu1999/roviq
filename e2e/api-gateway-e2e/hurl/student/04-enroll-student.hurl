# ============================================================
# Enroll Student — capacity check + section strength increment
# ============================================================
# Auth: inst_token injected by auth-setup.sh

# Get a student profile ID and a section
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "query { listStudents(filter: { first: 1 }) { edges { node { id currentSectionId currentStandardId currentAcademicYearId } } } }"
}
HTTP 200
[Captures]
student_id: jsonpath "$.data.listStudents.edges[0].node.id"

# Get section strength before enrollment
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
section_id: jsonpath "$.data.sections[0].id"
strength_before: jsonpath "$.data.sections[0].currentStrength"

# Enroll student
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "mutation($input: EnrollStudentInput!) { enrollStudent(input: $input) }",
  "variables": {
    "input": {
      "studentProfileId": "{{student_id}}",
      "academicYearId": "{{academic_year_id}}",
      "standardId": "{{standard_id}}",
      "sectionId": "{{section_id}}"
    }
  }
}
HTTP 200
[Asserts]
jsonpath "$.data.enrollStudent" != null

# Verify section strength incremented
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "query($standardId: ID!) { sections(standardId: $standardId) { id currentStrength } }",
  "variables": { "standardId": "{{standard_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.sections[0].currentStrength" > {{strength_before}}
