import type { MembershipWithInstituteAndRole, MembershipWithRole } from './types';

export abstract class MembershipRepository {
  abstract findActiveByUserId(userId: string): Promise<MembershipWithInstituteAndRole[]>;
  abstract findByUserAndTenant(
    userId: string,
    tenantId: string,
  ): Promise<MembershipWithInstituteAndRole | null>;
  abstract findFirstActive(userId: string): Promise<MembershipWithRole | null>;
}
