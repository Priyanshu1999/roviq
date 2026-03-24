# ============================================================
# Standards, Sections, Subjects — CRUD & Relationships
# Tests: standards, sections, subjects queries and mutations
# Uses admin (institute_admin) for write ops, teacher for read-only
# ============================================================

# ── Auth: Get institute-scoped token via admin multi-institute flow ──

# Step 1: Institute login as admin (multi-institute — returns selectionToken)
POST {{base_url}}/graphql
Content-Type: application/json
{
  "query": "mutation { instituteLogin(username: \"{{username}}\", password: \"{{password}}\") { selectionToken memberships { membershipId tenantId } } }"
}
HTTP 200
[Captures]
selection_token: jsonpath "$.data.instituteLogin.selectionToken"
membership_id: jsonpath "$.data.instituteLogin.memberships[0].membershipId"

# Step 2: Select institute to get institute-scoped token
POST {{base_url}}/graphql
Content-Type: application/json
{
  "query": "mutation SelectInstitute($selectionToken: String!, $membershipId: String!) { selectInstitute(selectionToken: $selectionToken, membershipId: $membershipId) { accessToken } }",
  "variables": { "selectionToken": "{{selection_token}}", "membershipId": "{{membership_id}}" }
}
HTTP 200
[Captures]
admin_token: jsonpath "$.data.selectInstitute.accessToken"
[Asserts]
jsonpath "$.data.selectInstitute.accessToken" != null

# Step 3: Get active academic year ID (needed for standard/section creation)
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "{ activeAcademicYear { id label } }"
}
HTTP 200
[Captures]
year_id: jsonpath "$.data.activeAcademicYear.id"
[Asserts]
jsonpath "$.data.activeAcademicYear" != null

# ── Standards ──

# Step 4: List standards for the active academic year
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "query ListStandards($yearId: ID!) { standards(academicYearId: $yearId) { id name numericOrder level nepStage department isBoardExamClass streamApplicable maxSectionsAllowed maxStudentsPerSection } }",
  "variables": { "yearId": "{{year_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.standards" isCollection

# Step 5: Create a new standard
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "mutation CreateStandard($input: CreateStandardInput!) { createStandard(input: $input) { id name numericOrder level isBoardExamClass streamApplicable academicYearId } }",
  "variables": {
    "input": {
      "academicYearId": "{{year_id}}",
      "name": "Class 12 E2E",
      "numericOrder": 12,
      "level": "SENIOR_SECONDARY",
      "isBoardExamClass": true,
      "streamApplicable": true,
      "maxStudentsPerSection": 45
    }
  }
}
HTTP 200
[Captures]
standard_id: jsonpath "$.data.createStandard.id"
[Asserts]
jsonpath "$.data.createStandard.id" != null
jsonpath "$.data.createStandard.name" == "Class 12 E2E"
jsonpath "$.data.createStandard.numericOrder" == 12
jsonpath "$.data.createStandard.level" == "SENIOR_SECONDARY"
jsonpath "$.data.createStandard.isBoardExamClass" == true
jsonpath "$.data.createStandard.streamApplicable" == true

# Step 6: Get standard by ID
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "query GetStandard($id: ID!) { standard(id: $id) { id name numericOrder level } }",
  "variables": { "id": "{{standard_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.standard.id" == {{standard_id}}
jsonpath "$.data.standard.name" == "Class 12 E2E"

# Step 7: Update the standard
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "mutation UpdateStandard($id: ID!, $input: UpdateStandardInput!) { updateStandard(id: $id, input: $input) { id name department } }",
  "variables": { "id": "{{standard_id}}", "input": { "department": "Science" } }
}
HTTP 200
[Asserts]
jsonpath "$.data.updateStandard.id" == {{standard_id}}
jsonpath "$.data.updateStandard.department" == "Science"

# ── Sections ──

# Step 8: Create a section under the new standard
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "mutation CreateSection($input: CreateSectionInput!) { createSection(input: $input) { id name standardId academicYearId genderRestriction capacity currentStrength displayOrder } }",
  "variables": {
    "input": {
      "standardId": "{{standard_id}}",
      "academicYearId": "{{year_id}}",
      "name": "A",
      "displayLabel": "12-A Science",
      "mediumOfInstruction": "English",
      "capacity": 45,
      "genderRestriction": "CO_ED"
    }
  }
}
HTTP 200
[Captures]
section_id: jsonpath "$.data.createSection.id"
[Asserts]
jsonpath "$.data.createSection.id" != null
jsonpath "$.data.createSection.name" == "A"
jsonpath "$.data.createSection.standardId" == {{standard_id}}
jsonpath "$.data.createSection.genderRestriction" == "CO_ED"
jsonpath "$.data.createSection.capacity" == 45
jsonpath "$.data.createSection.currentStrength" == 0

# Step 9: Create a second section
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "mutation CreateSection($input: CreateSectionInput!) { createSection(input: $input) { id name } }",
  "variables": {
    "input": {
      "standardId": "{{standard_id}}",
      "academicYearId": "{{year_id}}",
      "name": "B",
      "displayLabel": "12-B Science",
      "mediumOfInstruction": "English",
      "capacity": 45
    }
  }
}
HTTP 200
[Captures]
section_b_id: jsonpath "$.data.createSection.id"
[Asserts]
jsonpath "$.data.createSection.name" == "B"

# Step 10: List sections for the standard
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "query ListSections($standardId: ID!) { sections(standardId: $standardId) { id name standardId displayLabel capacity genderRestriction } }",
  "variables": { "standardId": "{{standard_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.sections" count >= 2

# Step 11: Get section by ID
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "query GetSection($id: ID!) { section(id: $id) { id name displayLabel mediumOfInstruction capacity } }",
  "variables": { "id": "{{section_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.section.id" == {{section_id}}
jsonpath "$.data.section.name" == "A"
jsonpath "$.data.section.displayLabel" == "12-A Science"
jsonpath "$.data.section.mediumOfInstruction" == "English"

# Step 12: Update section
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "mutation UpdateSection($id: ID!, $input: UpdateSectionInput!) { updateSection(id: $id, input: $input) { id room capacity } }",
  "variables": { "id": "{{section_id}}", "input": { "room": "Lab 301", "capacity": 50 } }
}
HTTP 200
[Asserts]
jsonpath "$.data.updateSection.id" == {{section_id}}
jsonpath "$.data.updateSection.room" == "Lab 301"
jsonpath "$.data.updateSection.capacity" == 50

# ── Subjects ──

# Step 13: List all subjects
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "{ subjects { id name shortName type isMandatory hasPractical isElective } }"
}
HTTP 200
[Asserts]
jsonpath "$.data.subjects" isCollection

# Step 14: Create a new subject
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "mutation CreateSubject($input: CreateSubjectInput!) { createSubject(input: $input) { id name shortName type isMandatory hasPractical theoryMarks practicalMarks isElective } }",
  "variables": {
    "input": {
      "name": "Physics E2E",
      "shortName": "PHY",
      "type": "ACADEMIC",
      "isMandatory": true,
      "hasPractical": true,
      "theoryMarks": 70,
      "practicalMarks": 30
    }
  }
}
HTTP 200
[Captures]
subject_id: jsonpath "$.data.createSubject.id"
[Asserts]
jsonpath "$.data.createSubject.id" != null
jsonpath "$.data.createSubject.name" == "Physics E2E"
jsonpath "$.data.createSubject.shortName" == "PHY"
jsonpath "$.data.createSubject.type" == "ACADEMIC"
jsonpath "$.data.createSubject.isMandatory" == true
jsonpath "$.data.createSubject.hasPractical" == true
jsonpath "$.data.createSubject.theoryMarks" == 70
jsonpath "$.data.createSubject.practicalMarks" == 30

# Step 15: Get subject by ID
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "query GetSubject($id: ID!) { subject(id: $id) { id name shortName type } }",
  "variables": { "id": "{{subject_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.subject.id" == {{subject_id}}
jsonpath "$.data.subject.name" == "Physics E2E"

# Step 16: Update subject
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "mutation UpdateSubject($id: ID!, $input: UpdateSubjectInput!) { updateSubject(id: $id, input: $input) { id name boardCode internalMarks } }",
  "variables": { "id": "{{subject_id}}", "input": { "boardCode": "041", "internalMarks": 20 } }
}
HTTP 200
[Asserts]
jsonpath "$.data.updateSubject.id" == {{subject_id}}
jsonpath "$.data.updateSubject.boardCode" == "041"
jsonpath "$.data.updateSubject.internalMarks" == 20

# Step 17: Create an elective subject
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "mutation CreateSubject($input: CreateSubjectInput!) { createSubject(input: $input) { id name isElective electiveGroup type } }",
  "variables": {
    "input": {
      "name": "Music E2E",
      "type": "EXTRACURRICULAR",
      "isElective": true,
      "electiveGroup": "Arts"
    }
  }
}
HTTP 200
[Captures]
elective_id: jsonpath "$.data.createSubject.id"
[Asserts]
jsonpath "$.data.createSubject.isElective" == true
jsonpath "$.data.createSubject.electiveGroup" == "Arts"
jsonpath "$.data.createSubject.type" == "EXTRACURRICULAR"

# ── Subject-Standard Assignment ──

# Step 18: Assign subject to standard
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "mutation AssignSubject($subjectId: ID!, $standardId: ID!) { assignSubjectToStandard(subjectId: $subjectId, standardId: $standardId) }",
  "variables": { "subjectId": "{{subject_id}}", "standardId": "{{standard_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.assignSubjectToStandard" == true

# Step 19: List subjects by standard — verify assignment
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "query SubjectsByStandard($standardId: ID!) { subjectsByStandard(standardId: $standardId) { id name } }",
  "variables": { "standardId": "{{standard_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.subjectsByStandard" count >= 1

# Step 20: Remove subject from standard
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "mutation RemoveSubject($subjectId: ID!, $standardId: ID!) { removeSubjectFromStandard(subjectId: $subjectId, standardId: $standardId) }",
  "variables": { "subjectId": "{{subject_id}}", "standardId": "{{standard_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.removeSubjectFromStandard" == true

# ── Subject-Section Assignment ──

# Step 21: Assign subject to section
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "mutation AssignToSection($subjectId: ID!, $sectionId: ID!) { assignSubjectToSection(subjectId: $subjectId, sectionId: $sectionId) }",
  "variables": { "subjectId": "{{subject_id}}", "sectionId": "{{section_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.assignSubjectToSection" == true

# Step 22: Remove subject from section
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "mutation RemoveFromSection($subjectId: ID!, $sectionId: ID!) { removeSubjectFromSection(subjectId: $subjectId, sectionId: $sectionId) }",
  "variables": { "subjectId": "{{subject_id}}", "sectionId": "{{section_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.removeSubjectFromSection" == true

# ── Teacher Read-Only Verification ──

# Step 23: Login as teacher (single institute — direct accessToken)
POST {{base_url}}/graphql
Content-Type: application/json
{
  "query": "mutation { instituteLogin(username: \"{{teacher_username}}\", password: \"{{teacher_password}}\") { accessToken } }"
}
HTTP 200
[Captures]
teacher_token: jsonpath "$.data.instituteLogin.accessToken"
[Asserts]
jsonpath "$.data.instituteLogin.accessToken" != null

# Step 24: Teacher can read standards
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{teacher_token}}
{
  "query": "query ListStandards($yearId: ID!) { standards(academicYearId: $yearId) { id name } }",
  "variables": { "yearId": "{{year_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.standards" isCollection

# Step 25: Teacher cannot create standards
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{teacher_token}}
{
  "query": "mutation CreateStandard($input: CreateStandardInput!) { createStandard(input: $input) { id } }",
  "variables": {
    "input": {
      "academicYearId": "{{year_id}}",
      "name": "Unauthorized Standard",
      "numericOrder": 99
    }
  }
}
HTTP 200
[Asserts]
jsonpath "$.data.createStandard" == null
jsonpath "$.errors" count >= 1

# Step 26: Teacher can read subjects
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{teacher_token}}
{
  "query": "{ subjects { id name type } }"
}
HTTP 200
[Asserts]
jsonpath "$.data.subjects" isCollection

# Step 27: Teacher cannot create subjects
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{teacher_token}}
{
  "query": "mutation CreateSubject($input: CreateSubjectInput!) { createSubject(input: $input) { id } }",
  "variables": { "input": { "name": "Unauthorized Subject" } }
}
HTTP 200
[Asserts]
jsonpath "$.data.createSubject" == null
jsonpath "$.errors" count >= 1

# ── Cleanup: Delete test entities ──

# Step 28: Delete the elective subject
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "mutation DeleteSubject($id: ID!) { deleteSubject(id: $id) }",
  "variables": { "id": "{{elective_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.deleteSubject" == true

# Step 29: Delete the physics subject
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "mutation DeleteSubject($id: ID!) { deleteSubject(id: $id) }",
  "variables": { "id": "{{subject_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.deleteSubject" == true

# Step 30: Delete section B
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "mutation DeleteSection($id: ID!) { deleteSection(id: $id) }",
  "variables": { "id": "{{section_b_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.deleteSection" == true

# Step 31: Delete section A
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "mutation DeleteSection($id: ID!) { deleteSection(id: $id) }",
  "variables": { "id": "{{section_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.deleteSection" == true

# Step 32: Delete the test standard
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{admin_token}}
{
  "query": "mutation DeleteStandard($id: ID!) { deleteStandard(id: $id) }",
  "variables": { "id": "{{standard_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.deleteStandard" == true
