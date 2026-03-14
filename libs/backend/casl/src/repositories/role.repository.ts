import type { AbilitiesRecord } from './types';

export abstract class RoleRepository {
  abstract findAbilities(roleId: string): Promise<AbilitiesRecord | null>;
}
