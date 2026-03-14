import type { SubscriptionDetails, UserIdRecord } from './types';

export abstract class BillingReadRepository {
  abstract findSubscriptionDetails(subscriptionId: string): Promise<SubscriptionDetails | null>;
  abstract findPlatformAdminUser(): Promise<UserIdRecord | null>;
}
