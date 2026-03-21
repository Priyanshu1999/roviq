import type { ResellerMembershipWithResellerAndRole } from './types';

export abstract class ResellerMembershipRepository {
  abstract findByUserId(userId: string): Promise<ResellerMembershipWithResellerAndRole[]>;
  abstract findByUserAndReseller(
    userId: string,
    resellerId: string,
  ): Promise<ResellerMembershipWithResellerAndRole | null>;
}
