import { Int, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import DataLoader from 'dataloader';
import { SubscriptionPlanModel } from './models/subscription-plan.model';
import { SubscriptionRepository } from './repositories/subscription.repository';

/**
 * Resolves computed fields on SubscriptionPlanModel.
 * `subscriberCount` uses DataLoader to batch-count active subscriptions per plan.
 */
@Resolver(() => SubscriptionPlanModel)
export class PlanFieldResolver {
  private readonly countLoader: DataLoader<string, number>;

  constructor(private readonly subscriptionRepo: SubscriptionRepository) {
    this.countLoader = new DataLoader(async (planIds: readonly string[]) => {
      const counts = await this.subscriptionRepo.countByPlanIds([...planIds]);
      return planIds.map((id) => counts.get(id) ?? 0);
    });
  }

  @ResolveField('subscriberCount', () => Int)
  async resolveSubscriberCount(@Parent() plan: SubscriptionPlanModel): Promise<number> {
    return this.countLoader.load(plan.id);
  }
}
