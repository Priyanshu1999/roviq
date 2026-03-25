# Auth: reseller_token injected by auth-setup.sh
# ============================================================
# Reseller Billing Dashboard
# Queries MRR, overdue count, subscription breakdown.
# ============================================================

# Step 1: Query billing dashboard
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{reseller_token}}
{
  "query": "{ resellerBillingDashboard { mrr activeSubscriptions churnedLast30Days churnRate overdueInvoiceCount subscriptionsByStatus } }"
}
HTTP 200
[Asserts]
jsonpath "$.data.resellerBillingDashboard" != null
jsonpath "$.data.resellerBillingDashboard.activeSubscriptions" >= 0
jsonpath "$.data.resellerBillingDashboard.overdueInvoiceCount" >= 0
