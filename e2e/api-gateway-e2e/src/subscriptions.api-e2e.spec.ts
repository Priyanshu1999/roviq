/**
 * GraphQL Subscriptions E2E — first real callers of `subscribeOnce()`.
 *
 * Exercises the full ws-ticket exchange + graphql-ws → pubSub → filter pipeline
 * against the running api-gateway. Each test subscribes BEFORE triggering the
 * mutation that publishes the event.
 *
 * Selected subscriptions:
 *  - `instituteConfigUpdated` — triggered by `updateInstituteConfig`,
 *    filtered to the subscriber's own institute by tenantId.
 *  - `instituteBrandingUpdated` — triggered by `updateInstituteBranding`,
 *    same filter path.
 *  - Cross-tenant isolation: tenant A subscribes, tenant B triggers the
 *    mutation on its own institute, A's subscription must time out (the
 *    filter rejects cross-tenant events before delivery).
 *
 * The subscription return type is `InstituteModel`, but the pubSub payload
 * is `{ instituteId, changedFields | branding }` — it doesn't have most
 * model fields. Selecting `__typename` is safe because it resolves to the
 * static output type name without running field resolvers. Production bug
 * is tracked separately: the subscription should declare its actual payload
 * shape (or add a `resolve` function) rather than promising InstituteModel.
 */
import type { Mutation } from '@roviq/graphql/generated';
import { beforeAll, describe, expect, it } from 'vitest';
import { loginAsInstituteAdmin, loginAsInstituteAdminSecondInstitute } from './helpers/auth';
import { gql } from './helpers/gql-client';
import { subscribeOnce } from './helpers/ws-client';

// Short helper — graphql-ws delivers the `{ data }` envelope; `subscribeOnce`
// unwraps it to `data`.
type EventEnvelope<K extends string> = { [key in K]: { __typename: string } };

describe('GraphQL Subscriptions E2E', () => {
  let tenantAToken: string;

  beforeAll(async () => {
    const { accessToken } = await loginAsInstituteAdmin();
    tenantAToken = accessToken;
  });

  it('instituteConfigUpdated fires after updateInstituteConfig', async () => {
    // Subscribe FIRST — the graphql-ws client only starts receiving events
    // after `next` resolves for `connection_init`, which happens inside
    // `subscribeOnce`. We await the ticket exchange + subscribe call before
    // triggering the mutation to avoid races.
    const eventPromise = subscribeOnce<EventEnvelope<'instituteConfigUpdated'>>(
      `subscription { instituteConfigUpdated { __typename } }`,
      {},
      tenantAToken,
    );

    // Give the ws client a brief moment to complete `connection_init` and
    // register the subscription with the server before publishing the event.
    // Without this, fast mutations can fire before the server adds the
    // iterator to pubSub's listener list and the event is missed.
    await new Promise((r) => setTimeout(r, 200));

    const mutationRes = await gql<Pick<Mutation, 'updateInstituteConfig'>>(
      `mutation {
        updateInstituteConfig(input: { attendanceType: "LECTURE_WISE" }) { id }
      }`,
      undefined,
      tenantAToken,
    );
    // The mutation itself may or may not return errors depending on current
    // institute state — for this test we only care that the event is
    // published, which happens inside `updateConfig` regardless of the
    // downstream resolver result.
    if (mutationRes.errors) {
      throw new Error(`updateInstituteConfig failed: ${JSON.stringify(mutationRes.errors)}`);
    }

    const event = await eventPromise;
    expect(event.instituteConfigUpdated).toBeDefined();
    expect(event.instituteConfigUpdated.__typename).toBe('InstituteModel');
  });

  it('instituteBrandingUpdated fires after updateInstituteBranding', async () => {
    const eventPromise = subscribeOnce<EventEnvelope<'instituteBrandingUpdated'>>(
      `subscription { instituteBrandingUpdated { __typename } }`,
      {},
      tenantAToken,
    );

    await new Promise((r) => setTimeout(r, 200));

    const mutationRes = await gql<Pick<Mutation, 'updateInstituteBranding'>>(
      `mutation {
        updateInstituteBranding(input: { primaryColor: "#1a73e8" }) { id }
      }`,
      undefined,
      tenantAToken,
    );
    if (mutationRes.errors) {
      throw new Error(`updateInstituteBranding failed: ${JSON.stringify(mutationRes.errors)}`);
    }

    const event = await eventPromise;
    expect(event.instituteBrandingUpdated).toBeDefined();
    expect(event.instituteBrandingUpdated.__typename).toBe('InstituteModel');
  });

  it('instituteConfigUpdated does NOT leak across tenants (subscription filter)', async () => {
    const { accessToken: tenantBToken } = await loginAsInstituteAdminSecondInstitute();

    // Tenant A subscribes.
    const eventPromise = subscribeOnce<EventEnvelope<'instituteConfigUpdated'>>(
      `subscription { instituteConfigUpdated { __typename } }`,
      {},
      tenantAToken,
      2_500, // short timeout — we expect the subscription to TIME OUT
    );

    await new Promise((r) => setTimeout(r, 200));

    // Tenant B triggers updateInstituteConfig on ITS OWN institute.
    const mutationRes = await gql<Pick<Mutation, 'updateInstituteConfig'>>(
      `mutation {
        updateInstituteConfig(input: { attendanceType: "DAILY" }) { id }
      }`,
      undefined,
      tenantBToken,
    );
    if (mutationRes.errors) {
      throw new Error(
        `updateInstituteConfig (tenant B) failed: ${JSON.stringify(mutationRes.errors)}`,
      );
    }

    // Tenant A's subscription filter rejects tenant B's event. The promise
    // should reject with the built-in timeout.
    await expect(eventPromise).rejects.toThrow(/Subscription timeout/);
  });
});
