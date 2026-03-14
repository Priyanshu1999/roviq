import { Inject, Injectable, Logger } from '@nestjs/common';
import { PRISMA_CLIENT } from '@roviq/nestjs-prisma';
import type { PrismaClient } from '@roviq/prisma-client';
import { BillingReadRepository } from './billing-read.repository';
import type { SubscriptionDetails, UserIdRecord } from './types';

@Injectable()
export class BillingReadPrismaRepository extends BillingReadRepository {
  private readonly logger = new Logger(BillingReadPrismaRepository.name);

  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {
    super();
  }

  async findSubscriptionDetails(subscriptionId: string): Promise<SubscriptionDetails | null> {
    const sub = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        plan: true,
        organization: { select: { id: true, name: true } },
      },
    });

    if (!sub) {
      this.logger.warn(`Subscription ${subscriptionId} not found for notification`);
      return null;
    }

    return {
      subscriptionId: sub.id,
      organizationId: sub.organizationId,
      organizationName: sub.organization.name,
      planName: sub.plan.name,
      planAmount: sub.plan.amount,
      planCurrency: sub.plan.currency,
    };
  }

  async findPlatformAdminUser(): Promise<UserIdRecord | null> {
    return this.prisma.user.findUnique({
      where: { username: 'admin' },
      select: { id: true },
    });
  }
}
