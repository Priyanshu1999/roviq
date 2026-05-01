/**
 * Institute-scope GraphQL subscriptions (ROV-117, PRD §13).
 *
 * Filtered by tenantId from JWT — institute users only receive
 * events for their own institute.
 *
 * Uses in-memory PubSub for now. Can be replaced with NATS-backed
 * PubSub when scaling to multiple API gateway instances.
 */
import { Resolver, Subscription } from '@nestjs/graphql';
import { InstituteScope } from '@roviq/auth-backend';
import type { InstituteContext } from '@roviq/common-types';
import GraphQLJSON from 'graphql-type-json';
import { pubSub } from '../../common/pubsub';
import { InstituteModel } from './models/institute.model';

@InstituteScope()
@Resolver()
export class InstituteSubscriptionResolver {
  /** Any field change on the authenticated user's institute */
  @Subscription(() => InstituteModel, {
    filter: (
      payload: { instituteUpdated: { id: string } },
      _args: unknown,
      context: { req: { user: InstituteContext } },
    ) => payload.instituteUpdated.id === context.req.user.tenantId,
  })
  instituteUpdated() {
    return pubSub.asyncIterableIterator('INSTITUTE.updated');
  }

  /** Branding changes on the authenticated user's institute */
  @Subscription(() => InstituteModel, {
    filter: (
      payload: { instituteBrandingUpdated: { instituteId: string } },
      _args: unknown,
      context: { req: { user: InstituteContext } },
    ) => payload.instituteBrandingUpdated.instituteId === context.req.user.tenantId,
  })
  instituteBrandingUpdated() {
    return pubSub.asyncIterableIterator('INSTITUTE.branding_updated');
  }

  /** Config changes on the authenticated user's institute */
  @Subscription(() => InstituteModel, {
    filter: (
      payload: { instituteConfigUpdated: { instituteId: string } },
      _args: unknown,
      context: { req: { user: InstituteContext } },
    ) => payload.instituteConfigUpdated.instituteId === context.req.user.tenantId,
  })
  instituteConfigUpdated() {
    return pubSub.asyncIterableIterator('INSTITUTE.config_updated');
  }

  /** Setup progress updates for the authenticated user's institute */
  @Subscription(() => GraphQLJSON, {
    filter: (
      payload: { instituteSetupProgress: { instituteId: string } },
      _args: unknown,
      context: { req: { user: InstituteContext } },
    ) => payload.instituteSetupProgress.instituteId === context.req.user.tenantId,
  })
  instituteSetupProgress() {
    return pubSub.asyncIterableIterator('INSTITUTE.setup_progress');
  }
}
