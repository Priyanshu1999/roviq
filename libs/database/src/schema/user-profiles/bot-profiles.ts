import { BotRateLimitTier, BotStatus } from '@roviq/common-types';
import { sql } from 'drizzle-orm';
import {
  boolean,
  foreignKey,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { users } from '../auth/users';
import { tenantColumns } from '../common/columns';
import { botRateLimitTier, botStatus, botType as botTypeEnum } from '../common/enums';
import { tenantPolicies } from '../common/rls-policies';
import { institutes } from '../tenant/institutes';
import { memberships } from '../tenant/memberships';

/**
 * Tenant-scoped bot profiles — automated service accounts for notifications,
 * fee reminders, AI chatbots, integrations, and bulk operations.
 *
 * API key authentication: plain key returned ONCE at creation, only Argon2id
 * hash stored. `api_key_prefix` ('skbot_' + 8 chars) for identification in logs.
 *
 * Three-tier RLS enforced.
 */
export const botProfiles = pgTable(
  'bot_profiles',
  {
    id: uuid().default(sql`uuidv7()`).primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    membershipId: uuid('membership_id')
      .notNull()
      .unique()
      .references(() => memberships.id, { onDelete: 'restrict', onUpdate: 'cascade' }),

    /**
     * Bot purpose category:
     * - `SYSTEM_NOTIFICATION`: system-generated notifications (password reset, welcome, etc.)
     * - `FEE_REMINDER`: automated fee payment reminder messages
     * - `ATTENDANCE_NOTIFICATION`: daily attendance alerts to parents
     * - `HOMEWORK_REMINDER`: homework and assignment deadline reminders
     * - `AI_CHATBOT_PARENT`: AI-powered parent helpdesk chatbot
     * - `AI_CHATBOT_STUDENT`: AI-powered student learning assistant
     * - `INTEGRATION`: external system integration (ERP, LMS, etc.)
     * - `REPORT_GENERATION`: automated report card / UDISE+ export generation
     * - `BULK_OPERATION`: bulk data import/export operations
     * - `ADMISSION_CHATBOT`: admission enquiry chatbot on website/WhatsApp
     */
    botType: botTypeEnum('bot_type').notNull(),

    /** Argon2id hash of the API key — plain key is NEVER stored */
    apiKeyHash: text('api_key_hash'),
    /** 'skbot_' + first 8 chars of the key — for identification in logs/audit trail */
    apiKeyPrefix: varchar('api_key_prefix', { length: 14 }),
    apiKeyExpiresAt: timestamp('api_key_expires_at', { withTimezone: true }),
    /** Last time the bot made an API call — for monitoring inactive bots */
    lastActiveAt: timestamp('last_active_at', { withTimezone: true }),

    /**
     * Rate limit tier for this bot's API calls:
     * - `LOW`: 10 req/min — suitable for notification bots
     * - `MEDIUM`: 60 req/min — suitable for chatbots and integrations
     * - `HIGH`: 300 req/min — suitable for bulk operations and report generation
     */
    rateLimitTier: botRateLimitTier('rate_limit_tier').default(BotRateLimitTier.LOW),

    /** Bot-specific configuration: schedule, templates, AI model config, allowed data scopes */
    config: jsonb('config').default({}),
    /** Webhook URL for outbound event delivery to external systems */
    webhookUrl: text('webhook_url'),
    /** Cross-tenant platform bots (e.g., system notification bot shared across institutes) */
    isSystemBot: boolean('is_system_bot').notNull().default(false),

    /**
     * Bot lifecycle state:
     * - `ACTIVE`: bot is operational and can make API calls
     * - `SUSPENDED`: bot temporarily disabled by admin — API calls rejected
     * - `DEACTIVATED`: bot permanently disabled — must be re-created
     */
    status: botStatus('status').notNull().default(BotStatus.ACTIVE),

    ...tenantColumns,
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId],
      foreignColumns: [institutes.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),

    index('idx_bot_profiles_tenant').on(table.tenantId).where(sql`${table.deletedAt} IS NULL`),

    ...tenantPolicies('bot_profiles'),
  ],
).enableRLS();
