import { randomBytes } from 'node:crypto';
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { hash } from '@node-rs/argon2';
import {
  DRIZZLE_DB,
  type DrizzleDB,
  memberships,
  roles,
  rolesLive,
  users,
  withAdmin,
  withTenant,
} from '@roviq/database';
import { and, eq } from 'drizzle-orm';
import type { CreateBotInput } from './dto/create-bot.input';
import type { UpdateBotInput } from './dto/update-bot.input';
import type { BotModel } from './models/bot.model';
import type { CreateBotResponse } from './models/create-bot-response.model';
import { BotProfileRepository } from './repositories/bot-profile.repository';

/** API key prefix for bot service accounts */
const BOT_KEY_PREFIX = 'skbot_';

@Injectable()
export class BotService {
  private readonly logger = new Logger(BotService.name);

  constructor(
    private readonly repo: BotProfileRepository,
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDB,
    @Inject('JETSTREAM_CLIENT') private readonly natsClient: ClientProxy,
  ) {}

  async createBot(
    tenantId: string,
    input: CreateBotInput,
    createdBy: string,
  ): Promise<CreateBotResponse> {
    // 1. Generate API key: skbot_ + 32 random hex chars
    const keyRandom = randomBytes(16).toString('hex');
    const plainApiKey = `${BOT_KEY_PREFIX}${keyRandom}`;
    const apiKeyHash = await hash(plainApiKey);
    const apiKeyPrefix = `${BOT_KEY_PREFIX}${keyRandom.slice(0, 8)}`;

    // 2. Create user (platform-level, no RLS) with bot username/email
    const botUsername = `bot-${input.botType}-${randomBytes(4).toString('hex')}`;
    const botEmail = `bot-${randomBytes(4).toString('hex')}@bots.roviq.internal`;
    const passwordHash = await hash(randomBytes(32).toString('hex'));

    const user = await withAdmin(this.db, async (tx) => {
      const [created] = await tx
        .insert(users)
        .values({
          username: botUsername,
          email: botEmail,
          passwordHash,
        })
        .returning({ id: users.id });
      return created;
    });

    // 3. Find or create bot role for this tenant
    const roleId = await this.findOrCreateBotRole(tenantId, createdBy);

    // 4. Create membership (tenant-scoped)
    const membership = await withTenant(this.db, tenantId, async (tx) => {
      const [created] = await tx
        .insert(memberships)
        .values({
          userId: user.id,
          roleId,
          tenantId,
          status: 'ACTIVE',
          abilities: [],
          createdBy,
          updatedBy: createdBy,
        })
        .returning({ id: memberships.id });
      return created;
    });

    // 5. Create bot_profile row
    const config = input.config ? JSON.parse(input.config) : {};
    const botProfile = await this.repo.create({
      userId: user.id,
      membershipId: membership.id,
      tenantId,
      botType: input.botType,
      apiKeyHash,
      apiKeyPrefix,
      webhookUrl: input.webhookUrl,
      config,
      rateLimitTier: input.rateLimitTier ?? 'LOW',
      createdBy,
    });

    this.emitEvent('BOT.created', {
      botId: botProfile.id,
      tenantId,
      botType: input.botType,
    });

    return {
      bot: botProfile as unknown as BotModel,
      apiKey: plainApiKey,
    };
  }

  async rotateBotApiKey(botProfileId: string): Promise<CreateBotResponse> {
    const existing = await this.repo.findById(botProfileId);
    if (!existing) throw new NotFoundException(`Bot profile ${botProfileId} not found`);

    // Generate new key
    const keyRandom = randomBytes(16).toString('hex');
    const plainApiKey = `${BOT_KEY_PREFIX}${keyRandom}`;
    const apiKeyHash = await hash(plainApiKey);
    const apiKeyPrefix = `${BOT_KEY_PREFIX}${keyRandom.slice(0, 8)}`;

    const updated = await this.repo.update(botProfileId, {
      apiKeyHash,
      apiKeyPrefix,
    });

    this.emitEvent('BOT.api_key_rotated', {
      botId: botProfileId,
      tenantId: existing.tenantId,
    });

    return {
      bot: updated as unknown as BotModel,
      apiKey: plainApiKey,
    };
  }

  async listBots(filters?: { botType?: string; status?: string }): Promise<BotModel[]> {
    const records = await this.repo.findAll(filters);
    return records as unknown as BotModel[];
  }

  async updateBot(id: string, input: UpdateBotInput): Promise<BotModel> {
    const config = input.config !== undefined ? JSON.parse(input.config) : undefined;
    const record = await this.repo.update(id, {
      ...(config !== undefined && { config }),
      ...(input.webhookUrl !== undefined && { webhookUrl: input.webhookUrl }),
      ...(input.rateLimitTier !== undefined && { rateLimitTier: input.rateLimitTier }),
      ...(input.status !== undefined && { status: input.status }),
    });

    this.emitEvent('BOT.updated', {
      botId: id,
      tenantId: record.tenantId,
    });

    return record as unknown as BotModel;
  }

  async deleteBot(id: string, tenantId: string): Promise<boolean> {
    // Look up the bot profile's membership before soft-deleting
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException(`Bot profile ${id} not found`);

    const membershipId = existing.membershipId;

    // Soft delete the bot profile
    await this.repo.softDelete(id);

    // Revoke the bot's membership via withAdmin (memberships table is tenant-scoped,
    // but we already have the membershipId and need admin to update after soft delete)
    await withAdmin(this.db, async (tx) => {
      await tx
        .update(memberships)
        .set({ status: 'REVOKED' })
        .where(eq(memberships.id, membershipId));
    });

    this.emitEvent('BOT.deleted', { botId: id, tenantId });

    return true;
  }

  /**
   * Find the 'bot' role for this tenant, or create one if it doesn't exist.
   * The role name is stored as i18n JSON ({ "en": "Bot" }).
   */
  private async findOrCreateBotRole(tenantId: string, createdBy: string): Promise<string> {
    // Query all institute-scoped roles for this tenant
    const allRoles = await withAdmin(this.db, async (tx) => {
      return tx
        .select({ id: rolesLive.id, name: rolesLive.name })
        .from(rolesLive)
        .where(and(eq(rolesLive.tenantId, tenantId), eq(rolesLive.scope, 'institute')));
    });

    // Look for a role with en name = 'Bot'
    for (const role of allRoles) {
      const name = role.name as Record<string, string>;
      if (name.en?.toLowerCase() === 'bot') {
        return role.id;
      }
    }

    // No bot role found — create one
    const [newRole] = await withAdmin(this.db, async (tx) => {
      return tx
        .insert(roles)
        .values({
          tenantId,
          scope: 'institute',
          name: { en: 'Bot' },
          abilities: [],
          isDefault: false,
          isSystem: true,
          status: 'ACTIVE',
          createdBy,
          updatedBy: createdBy,
        })
        .returning({ id: roles.id });
    });

    return newRole.id;
  }

  private emitEvent(pattern: string, data: Record<string, unknown>) {
    this.natsClient.emit(pattern, data).subscribe({
      error: (err) => this.logger.warn(`Failed to emit ${pattern}`, err),
    });
  }
}
