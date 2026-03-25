export interface BotProfileRecord {
  id: string;
  userId: string;
  membershipId: string;
  tenantId: string;
  botType: string;
  apiKeyPrefix: string | null;
  status: string;
  rateLimitTier: string | null;
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
  botType: string;
  apiKeyHash: string;
  apiKeyPrefix: string;
  webhookUrl?: string;
  config?: unknown;
  rateLimitTier?: string;
  createdBy: string;
}

export interface UpdateBotProfileData {
  config?: unknown;
  webhookUrl?: string;
  rateLimitTier?: string;
  status?: string;
  apiKeyHash?: string;
  apiKeyPrefix?: string;
}
