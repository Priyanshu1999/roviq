# ============================================================
# Rotate Bot API Key — create a bot, then rotate its key
# Verifies the new key is different from the original and
# follows the skbot_ prefix convention.
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

# Step 3: Create a bot to rotate its key
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation CreateBot($input: CreateBotInput!) { createBot(input: $input) { apiKey bot { id apiKeyPrefix } } }",
  "variables": {
    "input": {
      "botType": "attendance_notification"
    }
  }
}
HTTP 200
[Captures]
bot_id: jsonpath "$.data.createBot.bot.id"
original_api_key: jsonpath "$.data.createBot.apiKey"
original_prefix: jsonpath "$.data.createBot.bot.apiKeyPrefix"
[Asserts]
jsonpath "$.data.createBot.apiKey" startsWith "skbot_"

# Step 4: Rotate the API key
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{access_token}}
{
  "query": "mutation RotateKey($botId: ID!) { rotateBotApiKey(botId: $botId) { apiKey bot { id apiKeyPrefix } } }",
  "variables": {
    "botId": "{{bot_id}}"
  }
}
HTTP 200
[Captures]
new_api_key: jsonpath "$.data.rotateBotApiKey.apiKey"
new_prefix: jsonpath "$.data.rotateBotApiKey.bot.apiKeyPrefix"
[Asserts]
jsonpath "$.data.rotateBotApiKey.apiKey" startsWith "skbot_"
jsonpath "$.data.rotateBotApiKey.bot.id" == {{bot_id}}
jsonpath "$.data.rotateBotApiKey.bot.apiKeyPrefix" startsWith "skbot_"
jsonpath "$.data.rotateBotApiKey.apiKey" != "{{original_api_key}}"
jsonpath "$.data.rotateBotApiKey.bot.apiKeyPrefix" != "{{original_prefix}}"
