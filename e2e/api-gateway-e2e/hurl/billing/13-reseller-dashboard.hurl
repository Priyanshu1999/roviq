# ============================================================
# Reseller Billing Dashboard
# Queries MRR, overdue count, subscription breakdown.
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

# Step 2: Query billing dashboard
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "{ resellerBillingDashboard { mrr activeSubscriptions churnedLast30Days churnRate overdueInvoiceCount subscriptionsByStatus } }"
}
HTTP 200
[Asserts]
jsonpath "$.data.resellerBillingDashboard" != null
jsonpath "$.data.resellerBillingDashboard.activeSubscriptions" >= 0
jsonpath "$.data.resellerBillingDashboard.overdueInvoiceCount" >= 0
