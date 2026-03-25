# ============================================================
# Create Bot — institute admin creates a fee_reminder bot
# Authenticates as institute admin, then creates a new bot.
# The plain API key is returned once at creation.
# ============================================================
# Auth: inst_token injected by auth-setup.sh

# Create a fee_reminder bot
POST {{base_url}}/graphql
Content-Type: application/json
Authorization: Bearer {{inst_token}}
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
