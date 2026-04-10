import { BotRateLimitTier, BotStatus, BotType } from '@roviq/common-types';

export interface BotProfileRecord {
  id: string;
  userId: string;
  membershipId: string;
  tenantId: string;
  botType: BotType;
  apiKeyPrefix: string | null;
  status: BotStatus;
  rateLimitTier: BotRateLimitTier | null;
  webhookUrl: string | null;
  isSystemBot: boolean;
  config: unknown;
  lastActiveAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateBotProfileData {
  userId: string;
  membershipId: string;
  tenantId: string;
  botType: BotType;
  apiKeyHash: string;
  apiKeyPrefix: string;
  webhookUrl?: string;
  config?: unknown;
  rateLimitTier?: BotRateLimitTier;
  createdBy: string;
}

export interface UpdateBotProfileData {
  config?: unknown;
  webhookUrl?: string;
  rateLimitTier?: BotRateLimitTier;
  status?: BotStatus;
  apiKeyHash?: string;
  apiKeyPrefix?: string;
}
