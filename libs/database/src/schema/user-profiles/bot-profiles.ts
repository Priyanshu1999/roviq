import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
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
    id: uuid().defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    membershipId: uuid('membership_id')
      .notNull()
      .unique()
      .references(() => memberships.id, { onDelete: 'restrict', onUpdate: 'cascade' }),

    /**
     * Bot purpose category:
     * - `system_notification`: system-generated notifications (password reset, welcome, etc.)
     * - `fee_reminder`: automated fee payment reminder messages
     * - `attendance_notification`: daily attendance alerts to parents
     * - `homework_reminder`: homework and assignment deadline reminders
     * - `ai_chatbot_parent`: AI-powered parent helpdesk chatbot
     * - `ai_chatbot_student`: AI-powered student learning assistant
     * - `integration`: external system integration (ERP, LMS, etc.)
     * - `report_generation`: automated report card / UDISE+ export generation
     * - `bulk_operation`: bulk data import/export operations
     * - `admission_chatbot`: admission enquiry chatbot on website/WhatsApp
     */
    botType: varchar('bot_type', { length: 30 }).notNull(),

    /** Argon2id hash of the API key — plain key is NEVER stored */
    apiKeyHash: text('api_key_hash'),
    /** 'skbot_' + first 8 chars of the key — for identification in logs/audit trail */
    apiKeyPrefix: varchar('api_key_prefix', { length: 12 }),
    apiKeyExpiresAt: timestamp('api_key_expires_at', { withTimezone: true }),
    /** Last time the bot made an API call — for monitoring inactive bots */
    lastActiveAt: timestamp('last_active_at', { withTimezone: true }),

    /**
     * Rate limit tier for this bot's API calls:
     * - `low`: 10 req/min — suitable for notification bots
     * - `medium`: 60 req/min — suitable for chatbots and integrations
     * - `high`: 300 req/min — suitable for bulk operations and report generation
     */
    rateLimitTier: varchar('rate_limit_tier', { length: 10 }).default('low'),

    /** Bot-specific configuration: schedule, templates, AI model config, allowed data scopes */
    config: jsonb('config').default({}),
    /** Webhook URL for outbound event delivery to external systems */
    webhookUrl: text('webhook_url'),
    /** Cross-tenant platform bots (e.g., system notification bot shared across institutes) */
    isSystemBot: boolean('is_system_bot').notNull().default(false),

    /**
     * Bot lifecycle state:
     * - `active`: bot is operational and can make API calls
     * - `suspended`: bot temporarily disabled by admin — API calls rejected
     * - `deactivated`: bot permanently disabled — must be re-created
     */
    status: varchar('status', { length: 20 }).notNull().default('active'),

    ...tenantColumns,
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId],
      foreignColumns: [institutes.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),

    check(
      'chk_bot_type',
      sql`${table.botType} IN (
        'system_notification', 'fee_reminder', 'attendance_notification',
        'homework_reminder', 'ai_chatbot_parent', 'ai_chatbot_student',
        'integration', 'report_generation', 'bulk_operation', 'admission_chatbot'
      )`,
    ),
    check(
      'chk_rate_limit_tier',
      sql`${table.rateLimitTier} IS NULL OR ${table.rateLimitTier} IN ('low', 'medium', 'high')`,
    ),
    check('chk_bot_status', sql`${table.status} IN ('active', 'suspended', 'deactivated')`),

    index('idx_bot_profiles_tenant').on(table.tenantId).where(sql`${table.deletedAt} IS NULL`),

    ...tenantPolicies('bot_profiles'),
  ],
).enableRLS();
