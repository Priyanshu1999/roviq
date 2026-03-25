import type { BotProfileRecord, CreateBotProfileData, UpdateBotProfileData } from './types';

export abstract class BotProfileRepository {
  abstract findById(id: string): Promise<BotProfileRecord | null>;
  abstract findAll(filters?: { botType?: string; status?: string }): Promise<BotProfileRecord[]>;
  abstract create(data: CreateBotProfileData): Promise<BotProfileRecord>;
  abstract update(id: string, data: UpdateBotProfileData): Promise<BotProfileRecord>;
  abstract softDelete(id: string): Promise<void>;
}
