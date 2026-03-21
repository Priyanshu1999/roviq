import type { PlatformMembershipWithRole } from './types';

export abstract class PlatformMembershipRepository {
  abstract findByUserId(userId: string): Promise<PlatformMembershipWithRole | null>;
}
