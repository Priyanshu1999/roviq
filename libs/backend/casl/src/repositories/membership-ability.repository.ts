import type { AbilitiesRecord } from './types';

export abstract class MembershipAbilityRepository {
  abstract findAbilities(userId: string, tenantId: string): Promise<AbilitiesRecord | null>;
}
