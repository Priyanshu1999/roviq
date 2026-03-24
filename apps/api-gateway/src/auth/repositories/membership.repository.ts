import type { MembershipWithInstituteAndRole, MembershipWithRole } from './types';

export abstract class MembershipRepository {
  abstract findActiveByUserId(userId: string): Promise<MembershipWithInstituteAndRole[]>;
  abstract findManyByUserAndTenant(
    userId: string,
    tenantId: string,
  ): Promise<MembershipWithInstituteAndRole[]>;
  abstract findByIdAndUser(
    membershipId: string,
    userId: string,
  ): Promise<MembershipWithInstituteAndRole | null>;
  abstract findFirstActive(userId: string): Promise<MembershipWithRole | null>;
}
