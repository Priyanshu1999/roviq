import assert from 'node:assert';
import { describe, expect, it } from 'vitest';
import { loginAsAdmin, loginAsAdminSecondInstitute } from './helpers/auth';
import { gql } from './helpers/gql-client';

describe('RLS Tenant Isolation E2E', () => {
  it('tenant A notification configs are not visible to tenant B', async () => {
    const { accessToken: tokenA, tenantId: tenantIdA } = await loginAsAdmin(0);
    const { accessToken: tokenB, tenantId: tenantIdB } = await loginAsAdminSecondInstitute();

    // Query notification configs as tenant A
    const resA = await gql(
      `query { notificationConfigs { id notificationType tenantId } }`,
      undefined,
      tokenA,
    );

    // Query notification configs as tenant B
    const resB = await gql(
      `query { notificationConfigs { id notificationType tenantId } }`,
      undefined,
      tokenB,
    );

    expect(resA.errors).toBeUndefined();
    expect(resB.errors).toBeUndefined();
    assert(resA.data);
    assert(resB.data);

    // Both should have configs (seeded for both institutes)
    expect(resA.data.notificationConfigs.length).toBeGreaterThan(0);
    expect(resB.data.notificationConfigs.length).toBeGreaterThan(0);

    // All configs from tenant A should have tenant A's ID
    const tenantIdsA = resA.data.notificationConfigs.map((c: { tenantId: string }) => c.tenantId);
    expect(tenantIdsA.every((id: string) => id === tenantIdA)).toBe(true);

    // All configs from tenant B should have tenant B's ID
    const tenantIdsB = resB.data.notificationConfigs.map((c: { tenantId: string }) => c.tenantId);
    expect(tenantIdsB.every((id: string) => id === tenantIdB)).toBe(true);

    // No overlap — tenant A IDs should not appear in tenant B results
    const idsA = new Set(resA.data.notificationConfigs.map((c: { id: string }) => c.id));
    const idsB = resB.data.notificationConfigs.map((c: { id: string }) => c.id);
    expect(idsB.some((id: string) => idsA.has(id))).toBe(false);
  });

  it('unauthenticated query should be rejected', async () => {
    const res = await gql(`query { notificationConfigs { id } }`);
    expect(res.errors).toBeDefined();
    expect(res.errors?.length).toBeGreaterThan(0);
  });
});
