# ============================================================
# List Invoices
# Reseller queries invoices list to verify generated invoices appear.
# ============================================================

# Step 1: Reseller login
POST {{base_url}}/graphql
Content-Type: application/json
{
  "query": "mutation { resellerLogin(username: \"{{reseller_username}}\", password: \"{{reseller_password}}\") { accessToken } }"
}
HTTP 200
[Captures]
access_token: jsonpath "$.data.resellerLogin.accessToken"
[Asserts]
jsonpath "$.data.resellerLogin.accessToken" != null

# Step 2: Query invoices
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "{ invoices(first: 10) { id invoiceNumber totalAmount status tenantId } }"
}
HTTP 200
[Asserts]
jsonpath "$.data.invoices" != null
