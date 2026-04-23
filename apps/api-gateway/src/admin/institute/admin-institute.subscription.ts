/**
 * Platform-scope GraphQL subscriptions for institute events.
 *
 * Platform admins see ALL institute events across the entire platform. Each
 * subscription returns either `InstituteModel` (for create/approval events)
 * or `SetupProgressModel` (for the setup-progress stream). Emitters spread
 * the full institute record so any selected field resolves.
 */
import { Args, ID, Resolver, Subscription } from '@nestjs/graphql';
import { PlatformScope } from '@roviq/auth-backend';
import { pubSub } from '../../common/pubsub';
import { InstituteModel } from '../../institute/management/models/institute.model';
import { SetupProgressModel } from './models/setup-progress.model';

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

  /**
   * Setup-progress stream for a specific institute, filtered server-side by
   * the `instituteId` argument so an admin only receives events for the
   * institute they are watching.
   */
  @Subscription(() => SetupProgressModel, {
    description:
      'Platform-admin setup progress stream for a specific institute — emits on every step transition',
    filter: (
      payload: { instituteSetupProgress: SetupProgressModel },
      variables: { instituteId: string },
    ) => payload.instituteSetupProgress.instituteId === variables.instituteId,
    resolve: (payload: { instituteSetupProgress: SetupProgressModel }) =>
      payload.instituteSetupProgress,
  })
  adminInstituteSetupProgress(@Args('instituteId', { type: () => ID }) _instituteId: string) {
    return pubSub.asyncIterableIterator('INSTITUTE.setup_progress');
  }
}
