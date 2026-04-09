import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';

/**
 * Bot purpose category — determines which automated tasks this bot performs.
 */
export enum BotTypeEnum {
  /** System-generated notifications (password reset, welcome, etc.) */
  SYSTEM_NOTIFICATION = 'SYSTEM_NOTIFICATION',
  /** Automated fee payment reminder messages */
  FEE_REMINDER = 'FEE_REMINDER',
  /** Daily attendance alerts to parents */
  ATTENDANCE_NOTIFICATION = 'ATTENDANCE_NOTIFICATION',
  /** Homework and assignment deadline reminders */
  HOMEWORK_REMINDER = 'HOMEWORK_REMINDER',
  /** AI-powered parent helpdesk chatbot */
  AI_CHATBOT_PARENT = 'AI_CHATBOT_PARENT',
  /** AI-powered student learning assistant */
  AI_CHATBOT_STUDENT = 'AI_CHATBOT_STUDENT',
  /** External system integration (ERP, LMS, etc.) */
  INTEGRATION = 'INTEGRATION',
  /** Automated report card / UDISE+ export generation */
  REPORT_GENERATION = 'REPORT_GENERATION',
  /** Bulk data import/export operations */
  BULK_OPERATION = 'BULK_OPERATION',
  /** Admission enquiry chatbot on website/WhatsApp */
  ADMISSION_CHATBOT = 'ADMISSION_CHATBOT',
}

/**
 * Bot lifecycle state — controls whether the bot can make API calls.
 */
export enum BotStatusEnum {
  /** Bot is operational and can make API calls */
  ACTIVE = 'ACTIVE',
  /** Bot temporarily disabled by admin — API calls rejected */
  SUSPENDED = 'SUSPENDED',
  /** Bot permanently disabled — must be re-created */
  DEACTIVATED = 'DEACTIVATED',
}

/**
 * Rate limit tier for bot API calls — controls request throughput.
 */
export enum RateLimitTierEnum {
  /** 10 req/min — suitable for notification bots */
  LOW = 'LOW',
  /** 60 req/min — suitable for chatbots and integrations */
  MEDIUM = 'MEDIUM',
  /** 300 req/min — suitable for bulk operations and report generation */
  HIGH = 'HIGH',
}

registerEnumType(BotTypeEnum, { name: 'BotType' });
registerEnumType(BotStatusEnum, { name: 'BotStatus' });
registerEnumType(RateLimitTierEnum, { name: 'RateLimitTier' });

@ObjectType()
export class BotModel {
  @Field(() => ID)
  id!: string;

  @Field(() => BotTypeEnum, { description: 'Bot purpose category' })
  botType!: BotTypeEnum;

  @Field(() => String, {
    nullable: true,
    description: "API key prefix for identification in logs ('skbot_' + first 8 chars)",
  })
  apiKeyPrefix?: string | null;

  @Field(() => BotStatusEnum, { description: 'Bot lifecycle state' })
  status!: BotStatusEnum;

  @Field(() => RateLimitTierEnum, { nullable: true, description: 'Rate limit tier for API calls' })
  rateLimitTier?: RateLimitTierEnum | null;

  @Field(() => String, { nullable: true, description: 'Webhook URL for outbound event delivery' })
  webhookUrl?: string | null;

  @Field({ description: 'Whether this is a cross-tenant platform bot' })
  isSystemBot!: boolean;

  @Field(() => GraphQLJSON, {
    nullable: true,
    description: 'Bot-specific configuration (schedule, templates, AI model config, etc.)',
  })
  config?: unknown;

  @Field(() => Date, { nullable: true, description: 'Last time the bot made an API call' })
  lastActiveAt?: Date | null;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}
