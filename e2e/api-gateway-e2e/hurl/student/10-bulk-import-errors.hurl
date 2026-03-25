# ============================================================
# Bulk Student Import — CSV with errors (partial success + error report)
#
# Flow:
# 1. bulkCreateStudents mutation with CSV containing invalid dates
# 2. Poll bulkImportProgress until completed
# 3. Assert: partial success (some created, some errors) + reportUrl present
#
# The test CSV has 5 rows:
# - Row 1-3: valid data
# - Row 4: invalid date format ("not-a-date")
# - Row 5: missing required field (no first_name)
#
# Requires:
#   - api-gateway running
#   - Temporal running with student-bulk-import worker
#   - Seeded DB with institute_1, academic year, standard, section
# ============================================================
# Auth: inst_token injected by auth-setup.sh

# Start bulk import with a CSV that has errors
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
{
  "query": "mutation BulkCreate($input: BulkCreateStudentsInput!) { bulkCreateStudents(input: $input) { workflowId } }",
  "variables": {
    "input": {
      "fileUrl": "{{base_url}}/test-fixtures/bulk-import-errors.csv",
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
Authorization: Bearer {{inst_token}}
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
# Rows 1-3 valid → created, rows 4-5 have errors
jsonpath "$.data.bulkImportProgress.created" >= 3
jsonpath "$.data.bulkImportProgress.errors" >= 2
# Error report should be generated since there are errors
jsonpath "$.data.bulkImportProgress.reportUrl" != null
