/**
 * Platform-scope GraphQL subscriptions for institute events.
 *
 * No filter — platform admins see ALL institute events across the entire
 * platform. Each subscription returns `InstituteModel`; emitters spread the
 * full institute record so any selected field resolves. An explicit
 * `resolve` maps from the pubSub key (camelCase of the NATS pattern) to the
 * subscription field payload.
 */
import { Resolver, Subscription } from '@nestjs/graphql';
import { PlatformScope } from '@roviq/auth-backend';
import { pubSub } from '../../common/pubsub';
import { InstituteModel } from '../../institute/management/models/institute.model';

@PlatformScope()
@Resolver()
export class AdminInstituteSubscriptionResolver {
  /** An institute has requested approval */
  @Subscription(() => InstituteModel, {
    resolve: (payload: { instituteApprovalRequested: InstituteModel }) =>
      payload.instituteApprovalRequested,
  })
  adminInstituteApprovalRequested() {
    return pubSub.asyncIterableIterator('INSTITUTE.approval_requested');
  }

  /** A new institute was created anywhere on the platform */
  @Subscription(() => InstituteModel, {
    resolve: (payload: { instituteCreated: InstituteModel }) => payload.instituteCreated,
  })
  adminInstituteCreated() {
    return pubSub.asyncIterableIterator('INSTITUTE.created');
  }
}
