/**
 * Bot domain E2E tests — migrated from e2e/api-gateway-e2e/hurl/bot/*.hurl
 *
 * Covers:
 *   01-create-bot    — institute admin creates a FEE_REMINDER bot; plain
 *                      apiKey returned once with skbot_ prefix; default
 *                      status=ACTIVE, rateLimitTier=LOW, isSystemBot=false
 *   02-rotate-key    — rotateBotApiKey issues a new key; new key and prefix
 *                      differ from the original; prefix remains skbot_
 */
import assert from 'node:assert';
import { BotRateLimitTier, BotStatus, BotType } from '@roviq/common-types';
import { beforeAll, describe, expect, it } from 'vitest';

import { loginAsInstituteAdmin } from './helpers/auth';
import { gql } from './helpers/gql-client';

interface CreateBotResponse {
  createBot: {
    apiKey: string;
    bot: {
      id: string;
      botType: BotType;
      apiKeyPrefix: string;
      status: BotStatus;
      rateLimitTier: BotRateLimitTier;
      isSystemBot: boolean;
      createdAt: string;
    };
  };
}

interface RotateKeyResponse {
  rotateBotApiKey: {
    apiKey: string;
    bot: { id: string; apiKeyPrefix: string };
  };
}

describe('Bot E2E', () => {
  let accessToken: string;

  beforeAll(async () => {
    const admin = await loginAsInstituteAdmin();
    accessToken = admin.accessToken;
  });

  // ─────────────────────────────────────────────────────
  // 01-create-bot
  // ─────────────────────────────────────────────────────
  describe('createBot', () => {
    it('creates a FEE_REMINDER bot with skbot_ prefix and expected defaults', async () => {
      const res = await gql<CreateBotResponse>(
        `mutation CreateBot($input: CreateBotInput!) {
          createBot(input: $input) {
            apiKey
            bot { id botType apiKeyPrefix status rateLimitTier isSystemBot createdAt }
          }
        }`,
        { input: { botType: BotType.FEE_REMINDER } },
        accessToken,
      );

      expect(res.errors).toBeUndefined();
      const { apiKey, bot } = res.data?.createBot ?? { apiKey: '', bot: null };
      assert(bot);

      // Plain API key is returned exactly once at creation. Prefix convention
      // is `skbot_` — anything else means the key-generator changed without
      // updating the tenant- and bot-auth layers that parse it.
      expect(apiKey.startsWith('skbot_')).toBe(true);
      expect(bot.id).toBeTruthy();
      expect(bot.apiKeyPrefix.startsWith('skbot_')).toBe(true);
      expect(bot.botType).toBe(BotType.FEE_REMINDER);
      expect(bot.status).toBe(BotStatus.ACTIVE);
      expect(bot.rateLimitTier).toBe(BotRateLimitTier.LOW);
      expect(bot.isSystemBot).toBe(false);
      expect(bot.createdAt).toBeTruthy();
    });
  });

  // ─────────────────────────────────────────────────────
  // 02-rotate-key
  // ─────────────────────────────────────────────────────
  describe('rotateBotApiKey', () => {
    it('issues a new key + prefix, both different from the originals', async () => {
      // Seed a bot to rotate.
      const createRes = await gql<CreateBotResponse>(
        `mutation CreateBot($input: CreateBotInput!) {
          createBot(input: $input) { apiKey bot { id apiKeyPrefix } }
        }`,
        { input: { botType: BotType.ATTENDANCE_NOTIFICATION } },
        accessToken,
      );
      expect(createRes.errors).toBeUndefined();
      const created = createRes.data?.createBot;
      assert(created);
      const botId = created.bot.id;
      const originalKey = created.apiKey;
      const originalPrefix = created.bot.apiKeyPrefix;
      expect(originalKey.startsWith('skbot_')).toBe(true);

      const rotateRes = await gql<RotateKeyResponse>(
        `mutation RotateKey($botId: ID!) {
          rotateBotApiKey(botId: $botId) {
            apiKey
            bot { id apiKeyPrefix }
          }
        }`,
        { botId },
        accessToken,
      );
      expect(rotateRes.errors).toBeUndefined();
      const rotated = rotateRes.data?.rotateBotApiKey;
      assert(rotated);

      expect(rotated.bot.id).toBe(botId);
      expect(rotated.apiKey.startsWith('skbot_')).toBe(true);
      expect(rotated.bot.apiKeyPrefix.startsWith('skbot_')).toBe(true);

      // Critical invariants — the whole point of rotation.
      expect(rotated.apiKey).not.toBe(originalKey);
      expect(rotated.bot.apiKeyPrefix).not.toBe(originalPrefix);
    });
  });
});
