/**
 * Reseller-scope GraphQL subscriptions for institute events.
 *
 * Filtered by resellerId from JWT — reseller users only receive events for
 * institutes belonging to their reseller.
 *
 * Both subscriptions return `InstituteModel`. Emitters spread the full
 * institute record into the payload so any selected field resolves. An
 * explicit `resolve` maps from the pubSub key (camelCase of the NATS
 * pattern — e.g. `instituteCreated`) to the subscription field payload.
 */
import { Resolver, Subscription } from '@nestjs/graphql';
import { ResellerScope } from '@roviq/auth-backend';
import type { AuthUser } from '@roviq/common-types';
import { pubSub } from '../../common/pubsub';
import { InstituteModel } from '../../institute/management/models/institute.model';

@ResellerScope()
@Resolver()
export class ResellerInstituteSubscriptionResolver {
  /** New institute created under this reseller */
  @Subscription(() => InstituteModel, {
    resolve: (payload: { instituteCreated: InstituteModel }) => payload.instituteCreated,
    filter: (
      payload: { instituteCreated: { resellerId?: string | null } },
      _args: unknown,
      context: { req: { user: import('@roviq/common-types').ResellerContext } },
    ) => payload.instituteCreated.resellerId === context.req.user.resellerId,
  })
  resellerInstituteCreated() {
    return pubSub.asyncIterableIterator('INSTITUTE.created');
  }

  /** Status change on an institute under this reseller */
  @Subscription(() => InstituteModel, {
    resolve: (payload: { instituteStatusChanged: InstituteModel }) =>
      payload.instituteStatusChanged,
    filter: (
      payload: { instituteStatusChanged: { resellerId?: string | null } },
      _args: unknown,
      context: { req: { user: import('@roviq/common-types').ResellerContext } },
    ) => payload.instituteStatusChanged.resellerId === context.req.user.resellerId,
  })
  resellerInstituteStatusChanged() {
    return pubSub.asyncIterableIterator('INSTITUTE.status_changed');
  }
}
