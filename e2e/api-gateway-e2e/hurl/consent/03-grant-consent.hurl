# ============================================================
# Grant Consent — DPDP Act 2023 parental consent flow
#
# Prerequisites: student + guardian + student-guardian link.
# This test logs in as admin, creates a student, creates a
# guardian (which auto-creates user + membership + guardian
# profile), links them, then grants whatsapp_communication
# consent.
#
# NOTE: grantConsent requires the caller to be a guardian (the
# service resolves guardianProfileId from the caller's
# membershipId). Since createGuardian creates a user with a
# placeholder password, we cannot log in as the guardian via
# Hurl. This test creates the prerequisites and attempts the
# consent mutation as admin, which will be rejected by the
# service's guardian profile check.
#
# Full E2E consent testing is covered in the Vitest integration
# tests (bot-consent-schema.integration.test.ts) where the DB
# can be manipulated directly to set up guardian credentials.
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

# Create a student (needed as consent target)
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "mutation($input: CreateStudentInput!) { createStudent(input: $input) { id } }",
  "variables": {
    "input": {
      "firstName": "Consent",
      "lastName": "TestStudent",
      "gender": "male",
      "dateOfBirth": "2016-01-15",
      "standardId": "{{standard_id}}",
      "sectionId": "{{section_id}}",
      "academicYearId": "{{academic_year_id}}"
    }
  }
}
HTTP 200
[Captures]
student_profile_id: jsonpath "$.data.createStudent.id"
[Asserts]
jsonpath "$.data.createStudent.id" != null

# Create a guardian and link to the student
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "mutation CreateGuardian($input: CreateGuardianInput!) { createGuardian(input: $input) { id membershipId } }",
  "variables": {
    "input": {
      "firstName": "Rajesh",
      "lastName": "Verma",
      "phone": "9876509901",
      "occupation": "Engineer",
      "studentProfileId": "{{student_profile_id}}",
      "relationship": "father",
      "isPrimaryContact": true
    }
  }
}
HTTP 200
[Captures]
guardian_profile_id: jsonpath "$.data.createGuardian.id"
[Asserts]
jsonpath "$.data.createGuardian.id" != null

# Attempt grantConsent as admin
# Expected: 200 with GraphQL error (admin is not a guardian —
# resolveGuardianProfileId will throw ForbiddenException).
# This confirms the guardian-only access restriction works.
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "mutation GrantConsent($input: GrantConsentInput!) { grantConsent(input: $input) { id purpose isGranted grantedAt withdrawnAt verificationMethod createdAt } }",
  "variables": {
    "input": {
      "studentProfileId": "{{student_profile_id}}",
      "purpose": "whatsapp_communication",
      "verificationMethod": "in_person_id_check"
    }
  }
}
HTTP 200
[Asserts]
# Admin calling grantConsent returns a Forbidden error because
# the admin's membershipId does not have a guardian profile.
jsonpath "$.errors" count >= 1
jsonpath "$.errors[0].message" contains "guardian"
