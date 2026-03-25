# ============================================================
# Create Bot — institute admin creates a fee_reminder bot
# Authenticates as institute admin, then creates a new bot.
# The plain API key is returned once at creation.
# ============================================================

# Step 1: Institute login (admin has memberships in multiple institutes)
POST {{base_url}}/graphql
Content-Type: application/json
{
  "query": "mutation { instituteLogin(username: \"{{username}}\", password: \"{{password}}\") { requiresInstituteSelection selectionToken memberships { membershipId tenantId } } }"
}
HTTP 200
[Captures]
membership_id: jsonpath "$.data.instituteLogin.memberships[0].membershipId"
selection_token: jsonpath "$.data.instituteLogin.selectionToken"

# Step 2: Select institute to get scoped token
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

# Step 3: Create a fee_reminder bot
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation CreateBot($input: CreateBotInput!) { createBot(input: $input) { apiKey bot { id botType apiKeyPrefix status rateLimitTier isSystemBot createdAt } } }",
  "variables": {
    "input": {
      "botType": "fee_reminder"
    }
  }
}
HTTP 200
[Captures]
bot_id: jsonpath "$.data.createBot.bot.id"
api_key: jsonpath "$.data.createBot.apiKey"
[Asserts]
jsonpath "$.data.createBot.apiKey" startsWith "skbot_"
jsonpath "$.data.createBot.bot.id" != null
jsonpath "$.data.createBot.bot.apiKeyPrefix" startsWith "skbot_"
jsonpath "$.data.createBot.bot.botType" == "fee_reminder"
jsonpath "$.data.createBot.bot.status" == "active"
jsonpath "$.data.createBot.bot.rateLimitTier" == "low"
jsonpath "$.data.createBot.bot.isSystemBot" == false
