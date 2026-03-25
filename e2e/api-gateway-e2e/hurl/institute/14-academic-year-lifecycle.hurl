# Auth: inst_token injected by auth-setup.sh, teacher_token injected by auth-setup.sh
# ============================================================
# Academic Year Lifecycle
# Tests: academicYears query, activeAcademicYear query,
#        createAcademicYear, activateAcademicYear, archiveAcademicYear
# Requires: institute_admin role (admin user via multi-institute flow)
# ============================================================

# Step 1: List academic years — verify at least 1 seeded year exists
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "{ academicYears { id label startDate endDate isActive status } }"
}
HTTP 200
[Captures]
seeded_year_id: jsonpath "$.data.academicYears[0].id"
seeded_year_label: jsonpath "$.data.academicYears[0].label"
[Asserts]
jsonpath "$.data.academicYears" count >= 1
jsonpath "$.data.academicYears[0].id" != null
jsonpath "$.data.academicYears[0].label" != null
jsonpath "$.data.academicYears[0].startDate" != null
jsonpath "$.data.academicYears[0].endDate" != null
jsonpath "$.data.academicYears[0].status" != null

# Step 2: Get active academic year — verify the seeded year is active
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "{ activeAcademicYear { id label isActive status } }"
}
HTTP 200
[Captures]
active_year_id: jsonpath "$.data.activeAcademicYear.id"
[Asserts]
jsonpath "$.data.activeAcademicYear" != null
jsonpath "$.data.activeAcademicYear.isActive" == true
jsonpath "$.data.activeAcademicYear.status" == "ACTIVE"

# Step 3: Get academic year by ID
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "query GetYear($id: ID!) { academicYear(id: $id) { id label startDate endDate isActive status } }",
  "variables": { "id": "{{active_year_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.academicYear.id" == {{active_year_id}}
jsonpath "$.data.academicYear.label" != null

# Step 4: Create a new academic year (future, non-overlapping, PLANNING status)
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "mutation CreateYear($input: CreateAcademicYearInput!) { createAcademicYear(input: $input) { id label startDate endDate isActive status } }",
  "variables": { "input": { "label": "2030-2031", "startDate": "2030-04-01", "endDate": "2031-03-31" } }
}
HTTP 200
[Captures]
new_year_id: jsonpath "$.data.createAcademicYear.id"
[Asserts]
jsonpath "$.data.createAcademicYear.id" != null
jsonpath "$.data.createAcademicYear.label" == "2030-2031"
jsonpath "$.data.createAcademicYear.startDate" == "2030-04-01"
jsonpath "$.data.createAcademicYear.endDate" == "2031-03-31"
jsonpath "$.data.createAcademicYear.isActive" == false
jsonpath "$.data.createAcademicYear.status" == "PLANNING"

# Step 5: Verify overlap validation — create year overlapping with 2030-2031
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "mutation CreateYear($input: CreateAcademicYearInput!) { createAcademicYear(input: $input) { id } }",
  "variables": { "input": { "label": "Overlap Test", "startDate": "2030-06-01", "endDate": "2031-05-31" } }
}
HTTP 200
[Asserts]
jsonpath "$.errors" count >= 1
jsonpath "$.errors[0].message" contains "overlaps"

# Step 6: Verify date validation — end date before start date
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "mutation CreateYear($input: CreateAcademicYearInput!) { createAcademicYear(input: $input) { id } }",
  "variables": { "input": { "label": "Invalid Dates", "startDate": "2032-04-01", "endDate": "2031-03-31" } }
}
HTTP 200
[Asserts]
jsonpath "$.errors" count >= 1
jsonpath "$.errors[0].message" contains "before"

# Step 7: Activate the new year (PLANNING -> ACTIVE, deactivates current active year)
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "mutation ActivateYear($id: ID!) { activateAcademicYear(id: $id) { id isActive status } }",
  "variables": { "id": "{{new_year_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.activateAcademicYear.id" == {{new_year_id}}
jsonpath "$.data.activateAcademicYear.isActive" == true
jsonpath "$.data.activateAcademicYear.status" == "ACTIVE"

# Step 8: Verify activating an already-active year fails
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "mutation ActivateYear($id: ID!) { activateAcademicYear(id: $id) { id } }",
  "variables": { "id": "{{new_year_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.activateAcademicYear" == null
jsonpath "$.errors" count >= 1
jsonpath "$.errors[0].message" contains "already active"

# Step 9: Verify archiving from ACTIVE fails (must be COMPLETING first)
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "mutation ArchiveYear($id: ID!) { archiveAcademicYear(id: $id) { id } }",
  "variables": { "id": "{{new_year_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.archiveAcademicYear" == null
jsonpath "$.errors" count >= 1
jsonpath "$.errors[0].message" contains "COMPLETING"

# Step 10: Update the new year's label
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "mutation UpdateYear($id: ID!, $input: UpdateAcademicYearInput!) { updateAcademicYear(id: $id, input: $input) { id label } }",
  "variables": { "id": "{{new_year_id}}", "input": { "label": "2030-31 Updated" } }
}
HTTP 200
[Asserts]
jsonpath "$.data.updateAcademicYear.id" == {{new_year_id}}
jsonpath "$.data.updateAcademicYear.label" == "2030-31 Updated"

# Step 11: Re-activate the original seeded year (restore original state)
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "mutation ActivateYear($id: ID!) { activateAcademicYear(id: $id) { id isActive status } }",
  "variables": { "id": "{{active_year_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.activateAcademicYear.id" == {{active_year_id}}
jsonpath "$.data.activateAcademicYear.isActive" == true

# Step 12: Verify teacher (read-only) cannot create academic years
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{teacher_token}}
{
  "query": "mutation CreateYear($input: CreateAcademicYearInput!) { createAcademicYear(input: $input) { id } }",
  "variables": { "input": { "label": "Unauthorized", "startDate": "2033-04-01", "endDate": "2034-03-31" } }
}
HTTP 200
[Asserts]
jsonpath "$.errors" count >= 1

# Step 13: Verify teacher CAN read academic years
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{teacher_token}}
{
  "query": "{ academicYears { id label status } }"
}
HTTP 200
[Asserts]
jsonpath "$.data.academicYears" count >= 1

# Step 14: Cleanup — delete the test academic year we created
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "mutation DeleteYear($id: ID!) { deleteAcademicYear(id: $id) }",
  "variables": { "id": "{{new_year_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.deleteAcademicYear" == true
