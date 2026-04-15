/**
 * Integration tests for institute-management domain events.
 *
 * Asserts that the GraphQL mutations in `institute.service.ts` publish the
 * expected pub/sub channels so the matching `@Subscription` resolvers can
 * deliver events to clients. These emitters previously went dark (the
 * subscriptions existed but no service emitted on the channel) — covered
 * here to prevent regression.
 *
 * The test subscribes to pubSub BEFORE issuing the mutation (events aren't
 * buffered) and awaits the iterator with a timeout.
 */
import { pubSub } from '@roviq/pubsub';
import {
  createInstituteToken,
  createIntegrationApp,
  createTestInstitute,
  gqlRequest,
  type IntegrationAppResult,
} from '@roviq/testing/integration';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../../../app/app.module';

/**
 * Wait for the next event on a pub/sub channel, or reject on timeout.
 *
 * pubSub is the in-memory graphql-subscriptions PubSub; the payload is
 * `{ [subscriptionField]: data }` where `subscriptionField` is derived from
 * the channel name by `EventBusService.toSubscriptionKey()`. For
 * `INSTITUTE.updated` the wrapper key is `instituteUpdated`.
 */
async function waitForEvent<T>(channel: string, timeoutMs = 3_000): Promise<T> {
  const iterator = pubSub.asyncIterableIterator<T>(channel);
  return await new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      iterator.return?.();
      reject(new Error(`Timeout waiting for pubSub channel '${channel}'`));
    }, timeoutMs);

    iterator
      .next()
      .then((result) => {
        clearTimeout(timer);
        if (result.done) {
          reject(new Error(`pubSub channel '${channel}' closed before event arrived`));
          return;
        }
        resolve(result.value);
      })
      .catch((err: unknown) => {
        clearTimeout(timer);
        reject(err as Error);
      });
  });
}

const UPDATE_INSTITUTE_INFO = /* GraphQL */ `
  mutation UpdateInstituteInfo($id: ID!, $input: UpdateInstituteInfoInput!) {
    updateInstituteInfo(id: $id, input: $input) {
      id
    }
  }
`;

interface UpdateInstituteInfoResponse {
  updateInstituteInfo: { id: string };
}

interface InstituteUpdatedEnvelope {
  instituteUpdated: {
    id: string;
    changedFields?: string[];
  };
}

describe('Institute management — domain events (integration)', () => {
  let result: IntegrationAppResult;
  let instituteToken: string;
  let tenantId: string;

  beforeAll(async () => {
    result = await createIntegrationApp({ modules: [AppModule] });
    const institute = await createTestInstitute(result.db);
    tenantId = institute.tenantId;
    instituteToken = createInstituteToken({
      sub: institute.userId,
      tenantId: institute.tenantId,
      membershipId: institute.membershipId,
      roleId: institute.roleId,
    });
  });

  afterAll(async () => {
    await result?.close();
  });

  it('updateInstituteInfo emits INSTITUTE.updated with tenant id + changedFields', async () => {
    // Subscribe BEFORE mutating — pubSub does not buffer past events.
    const eventPromise = waitForEvent<InstituteUpdatedEnvelope>('INSTITUTE.updated');

    const response = await gqlRequest<UpdateInstituteInfoResponse>(result.httpServer, {
      query: UPDATE_INSTITUTE_INFO,
      token: instituteToken,
      variables: {
        id: tenantId,
        input: {
          version: 1,
          name: { en: 'Renamed Test Institute' },
          timezone: 'Asia/Kolkata',
        },
      },
    });
    expect(response.errors).toBeUndefined();
    expect(response.data?.updateInstituteInfo.id).toBe(tenantId);

    const event = await eventPromise;
    expect(event.instituteUpdated).toBeDefined();
    // The subscription filter reads payload.instituteUpdated.id; the emitter
    // must spread the full record so this property is present.
    expect(event.instituteUpdated.id).toBe(tenantId);
    // changedFields is added by the emitter for client-side optimization.
    expect(Array.isArray(event.instituteUpdated.changedFields)).toBe(true);
    expect(event.instituteUpdated.changedFields).toEqual(
      expect.arrayContaining(['name', 'timezone']),
    );
  });
});
