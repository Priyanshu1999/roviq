# ============================================================
# Withdraw Consent — DPDP Act 2023 consent withdrawal
#
# Tests that withdrawConsent also requires guardian authentication.
# Same limitation as 03-grant-consent.hurl: admin cannot call
# consent mutations because the service requires the caller's
# membershipId to have a guardian profile.
#
# Full withdraw flow is verified in Vitest integration tests.
# ============================================================
# Auth: inst_token injected by auth-setup.sh

# Get academic year, standard, and section for student creation
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "query { activeAcademicYear { id } }"
}
HTTP 200
[Captures]
academic_year_id: jsonpath "$.data.activeAcademicYear.id"

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

# Create student for consent target
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "mutation($input: CreateStudentInput!) { createStudent(input: $input) { id } }",
  "variables": {
    "input": {
      "firstName": "Withdraw",
      "lastName": "TestStudent",
      "gender": "female",
      "dateOfBirth": "2015-08-20",
      "standardId": "{{standard_id}}",
      "sectionId": "{{section_id}}",
      "academicYearId": "{{academic_year_id}}"
    }
  }
}
HTTP 200
[Captures]
student_profile_id: jsonpath "$.data.createStudent.id"

# Create guardian linked to student
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "mutation CreateGuardian($input: CreateGuardianInput!) { createGuardian(input: $input) { id } }",
  "variables": {
    "input": {
      "firstName": "Meera",
      "lastName": "Verma",
      "phone": "9876509902",
      "studentProfileId": "{{student_profile_id}}",
      "relationship": "mother",
      "isPrimaryContact": true
    }
  }
}
HTTP 200
[Asserts]
jsonpath "$.data.createGuardian.id" != null

# Attempt withdrawConsent as admin
# Expected: Forbidden — admin is not a guardian
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "mutation WithdrawConsent($input: WithdrawConsentInput!) { withdrawConsent(input: $input) { id purpose isGranted withdrawnAt createdAt } }",
  "variables": {
    "input": {
      "studentProfileId": "{{student_profile_id}}",
      "purpose": "whatsapp_communication"
    }
  }
}
HTTP 200
[Asserts]
# Admin calling withdrawConsent returns a Forbidden error because
# the admin's membershipId does not have a guardian profile.
jsonpath "$.errors" count >= 1
jsonpath "$.errors[0].message" contains "guardian"
