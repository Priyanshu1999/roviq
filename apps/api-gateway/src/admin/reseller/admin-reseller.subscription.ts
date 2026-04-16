/**
 * Platform-scope GraphQL subscriptions for reseller events (ROV-234).
 *
 * No filter — platform admins see every reseller event platform-wide. Payloads
 * carry the full reseller record so any selected field resolves; the resolver
 * lambda maps `pubSub` pattern → subscription field name (camelCase) per the
 * convention established by `AdminInstituteSubscriptionResolver`.
 */
import { Resolver, Subscription } from '@nestjs/graphql';
import { PlatformScope } from '@roviq/auth-backend';
import { pubSub } from '../../common/pubsub';
import { AdminResellerModel } from './models/admin-reseller.model';

@PlatformScope()
@Resolver()
export class AdminResellerSubscriptionResolver {
  /** A new reseller was created */
  @Subscription(() => AdminResellerModel, {
    resolve: (payload: { resellerCreated: AdminResellerModel }) => payload.resellerCreated,
  })
  adminResellerCreated() {
    return pubSub.asyncIterableIterator('RESELLER.created');
  }

  /** Reseller profile fields (name, branding, customDomain) changed */
  @Subscription(() => AdminResellerModel, {
    resolve: (payload: { resellerUpdated: AdminResellerModel }) => payload.resellerUpdated,
  })
  adminResellerUpdated() {
    return pubSub.asyncIterableIterator('RESELLER.updated');
  }

  /** Tier changed — staff role_ids were cascaded */
  @Subscription(() => AdminResellerModel, {
    resolve: (payload: { resellerTierChanged: AdminResellerModel }) => payload.resellerTierChanged,
  })
  adminResellerTierChanged() {
    return pubSub.asyncIterableIterator('RESELLER.tier_changed');
  }

  /** Status transition (suspend / unsuspend / delete) */
  @Subscription(() => AdminResellerModel, {
    resolve: (payload: { resellerStatusChanged: AdminResellerModel }) =>
      payload.resellerStatusChanged,
  })
  adminResellerStatusChanged() {
    return pubSub.asyncIterableIterator('RESELLER.status_changed');
  }
}
