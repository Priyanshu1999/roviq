# Auth: reseller_token injected by auth-setup.sh
# ============================================================
# List Invoices
# Reseller queries invoices list to verify generated invoices appear.
# ============================================================

# Step 1: Query invoices
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{reseller_token}}
{
  "query": "{ invoices(first: 10) { id invoiceNumber totalAmount status tenantId } }"
}
HTTP 200
[Asserts]
jsonpath "$.data.invoices" != null
