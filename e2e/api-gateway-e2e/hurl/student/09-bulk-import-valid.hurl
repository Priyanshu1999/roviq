# ============================================================
# Bulk Student Import — Valid CSV (5 rows, all created)
#
# Flow:
# 1. Institute login → selectInstitute → access token
# 2. bulkCreateStudents mutation with valid 5-row CSV URL
# 3. Poll bulkImportProgress until completed
# 4. Assert: 5 created, 0 skipped, 0 errors
#
# Requires:
#   - api-gateway running
#   - Temporal running with student-bulk-import worker
#   - Seeded DB with institute_1, academic year, standard, section
# ============================================================

# Step 1: Institute login
POST {{base_url}}/graphql
Content-Type: application/json
{
  "query": "mutation { instituteLogin(username: \"{{username}}\", password: \"{{password}}\") { requiresInstituteSelection selectionToken memberships { membershipId tenantId } } }"
}
HTTP 200
[Captures]
membership_id: jsonpath "$.data.instituteLogin.memberships[0].membershipId"
selection_token: jsonpath "$.data.instituteLogin.selectionToken"
[Asserts]
jsonpath "$.data.instituteLogin.requiresInstituteSelection" == true

# Step 2: Select institute
POST {{base_url}}/graphql
Content-Type: application/json
{
  "query": "mutation SelectInstitute($selectionToken: String!, $membershipId: String!) { selectInstitute(selectionToken: $selectionToken, membershipId: $membershipId) { accessToken } }",
  "variables": { "selectionToken": "{{selection_token}}", "membershipId": "{{membership_id}}" }
}
HTTP 200
[Captures]
access_token: jsonpath "$.data.selectInstitute.accessToken"
[Asserts]
jsonpath "$.data.selectInstitute.accessToken" != null

# Step 3: Start bulk import with a valid 5-row CSV
# NOTE: fileUrl points to a test CSV fixture served by MinIO or a local HTTP server.
# In CI, this is pre-uploaded by the e2e setup script.
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation BulkCreate($input: BulkCreateStudentsInput!) { bulkCreateStudents(input: $input) { workflowId } }",
  "variables": {
    "input": {
      "fileUrl": "{{base_url}}/test-fixtures/bulk-import-valid-5.csv",
      "academicYearId": "{{academic_year_id}}",
      "standardId": "{{standard_id}}",
      "sectionId": "{{section_id}}",
      "fieldMapping": {
        "Student Name": "first_name",
        "Last Name": "last_name",
        "DOB": "date_of_birth",
        "Gender": "gender",
        "Father Name": "father_name",
        "Mother Name": "mother_name",
        "Mobile": "phone"
      }
    }
  }
}
HTTP 200
[Captures]
workflow_id: jsonpath "$.data.bulkCreateStudents.workflowId"
[Asserts]
jsonpath "$.data.bulkCreateStudents.workflowId" != null

# Step 4: Poll for progress (retry until completed)
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
[Options]
retry: 20
retry-interval: 2000ms
{
  "query": "query Progress($id: String!) { bulkImportProgress(workflowId: $id) { status totalRows processed created skipped errors reportUrl } }",
  "variables": { "id": "{{workflow_id}}" }
}
HTTP 200
[Asserts]
jsonpath "$.data.bulkImportProgress.status" == "completed"
jsonpath "$.data.bulkImportProgress.totalRows" == 5
jsonpath "$.data.bulkImportProgress.created" == 5
jsonpath "$.data.bulkImportProgress.skipped" == 0
jsonpath "$.data.bulkImportProgress.errors" == 0
