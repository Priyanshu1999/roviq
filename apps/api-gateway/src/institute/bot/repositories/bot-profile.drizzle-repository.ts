import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { botProfiles, DRIZZLE_DB, type DrizzleDB, withTenant } from '@roviq/database';
import { getRequestContext } from '@roviq/request-context';
import { and, eq, isNull } from 'drizzle-orm';
import { BotProfileRepository } from './bot-profile.repository';
import type { BotProfileRecord, CreateBotProfileData, UpdateBotProfileData } from './types';

const columns = {
  id: botProfiles.id,
  userId: botProfiles.userId,
  membershipId: botProfiles.membershipId,
  tenantId: botProfiles.tenantId,
  botType: botProfiles.botType,
  apiKeyPrefix: botProfiles.apiKeyPrefix,
  status: botProfiles.status,
  rateLimitTier: botProfiles.rateLimitTier,
  webhookUrl: botProfiles.webhookUrl,
  isSystemBot: botProfiles.isSystemBot,
  config: botProfiles.config,
  lastActiveAt: botProfiles.lastActiveAt,
  createdAt: botProfiles.createdAt,
  updatedAt: botProfiles.updatedAt,
} as const;

@Injectable()
export class BotProfileDrizzleRepository extends BotProfileRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {
    super();
  }

  private getTenantId(): string {
    const { tenantId } = getRequestContext();
    if (!tenantId) throw new Error('Tenant context is required');
    return tenantId;
  }

  async findById(id: string): Promise<BotProfileRecord | null> {
    const tenantId = this.getTenantId();
    return withTenant(this.db, tenantId, async (tx) => {
      const rows = await tx.select(columns).from(botProfiles).where(eq(botProfiles.id, id));
      return (rows[0] as BotProfileRecord | undefined) ?? null;
    });
  }

  async findAll(filters?: { botType?: string; status?: string }): Promise<BotProfileRecord[]> {
    const tenantId = this.getTenantId();
    return withTenant(this.db, tenantId, async (tx) => {
      const conditions = [];
      if (filters?.botType) {
        conditions.push(eq(botProfiles.botType, filters.botType));
      }
      if (filters?.status) {
        conditions.push(eq(botProfiles.status, filters.status));
      }

      const query = tx.select(columns).from(botProfiles);
      if (conditions.length > 0) {
        return query.where(and(...conditions)) as Promise<BotProfileRecord[]>;
      }
      return query as unknown as Promise<BotProfileRecord[]>;
    });
  }

  async create(data: CreateBotProfileData): Promise<BotProfileRecord> {
    const tenantId = this.getTenantId();
    return withTenant(this.db, tenantId, async (tx) => {
      const rows = await tx
        .insert(botProfiles)
        .values({
          userId: data.userId,
          membershipId: data.membershipId,
          tenantId: data.tenantId,
          botType: data.botType,
          apiKeyHash: data.apiKeyHash,
          apiKeyPrefix: data.apiKeyPrefix,
          webhookUrl: data.webhookUrl,
          config: data.config ?? {},
          rateLimitTier: data.rateLimitTier ?? 'low',
          status: 'active',
          isSystemBot: false,
          createdBy: data.createdBy,
          updatedBy: data.createdBy,
        })
        .returning(columns);
      return rows[0] as BotProfileRecord;
    });
  }

  async update(id: string, data: UpdateBotProfileData): Promise<BotProfileRecord> {
    const tenantId = this.getTenantId();
    const { userId } = getRequestContext();
    return withTenant(this.db, tenantId, async (tx) => {
      const rows = await tx
        .update(botProfiles)
        .set({
          ...(data.config !== undefined && { config: data.config }),
          ...(data.webhookUrl !== undefined && { webhookUrl: data.webhookUrl }),
          ...(data.rateLimitTier !== undefined && { rateLimitTier: data.rateLimitTier }),
          ...(data.status !== undefined && { status: data.status }),
          ...(data.apiKeyHash !== undefined && { apiKeyHash: data.apiKeyHash }),
          ...(data.apiKeyPrefix !== undefined && { apiKeyPrefix: data.apiKeyPrefix }),
          updatedBy: userId,
        })
        .where(and(eq(botProfiles.id, id), isNull(botProfiles.deletedAt)))
        .returning(columns);

      if (rows.length === 0) throw new NotFoundException(`Bot profile ${id} not found`);
      return rows[0] as BotProfileRecord;
    });
  }

  async softDelete(id: string): Promise<void> {
    const tenantId = this.getTenantId();
    const { userId } = getRequestContext();
    await withTenant(this.db, tenantId, async (tx) => {
      const rows = await tx
        .update(botProfiles)
        .set({ deletedAt: new Date(), deletedBy: userId, updatedBy: userId })
        .where(and(eq(botProfiles.id, id), isNull(botProfiles.deletedAt)))
        .returning({ id: botProfiles.id });
      if (rows.length === 0) throw new NotFoundException(`Bot profile ${id} not found`);
    });
  }
}
