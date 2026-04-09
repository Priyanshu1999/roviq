import assert from 'node:assert';
import type { NotificationConfigModel, StudentConnection } from '@roviq/graphql/generated';
import { describe, expect, it } from 'vitest';
import { SEED_IDS } from '../../../scripts/seed-ids';
import { loginAsInstituteAdmin, loginAsInstituteAdminSecondInstitute } from './helpers/auth';
import { gql } from './helpers/gql-client';

describe('RLS Tenant Isolation E2E', () => {
  it('tenant A notification configs are not visible to tenant B', async () => {
    const { accessToken: tokenA, tenantId: tenantIdA } = await loginAsInstituteAdmin(0);
    const { accessToken: tokenB, tenantId: tenantIdB } =
      await loginAsInstituteAdminSecondInstitute();

    // Query notification configs as tenant A
    const resA = await gql<{ notificationConfigs: NotificationConfigModel[] }>(
      `query { notificationConfigs { id notificationType tenantId } }`,
      undefined,
      tokenA,
    );

    // Query notification configs as tenant B
    const resB = await gql<{ notificationConfigs: NotificationConfigModel[] }>(
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
    const tenantIdsA = resA.data.notificationConfigs.map((c) => c.tenantId);
    expect(tenantIdsA.every((id) => id === tenantIdA)).toBe(true);

    // All configs from tenant B should have tenant B's ID
    const tenantIdsB = resB.data.notificationConfigs.map((c) => c.tenantId);
    expect(tenantIdsB.every((id) => id === tenantIdB)).toBe(true);

    // No overlap — tenant A IDs should not appear in tenant B results
    const idsA = new Set(resA.data.notificationConfigs.map((c) => c.id));
    const idsB = resB.data.notificationConfigs.map((c) => c.id);
    expect(idsB.some((id) => idsA.has(id))).toBe(false);
  });

  it('unauthenticated query should be rejected', async () => {
    const res = await gql(`query { notificationConfigs { id } }`);
    expect(res.errors).toBeDefined();
    expect(res.errors?.length).toBeGreaterThan(0);
  });

  it('tenant A students are not visible to tenant B (listStudents)', async () => {
    const { accessToken: tokenA, tenantId: tenantIdA } = await loginAsInstituteAdmin(0);
    const { accessToken: tokenB, tenantId: tenantIdB } =
      await loginAsInstituteAdminSecondInstitute();

    const query = `query {
      listStudents { edges { node { id tenantId } } }
    }`;

    const resA = await gql<{ listStudents: StudentConnection }>(query, undefined, tokenA);
    const resB = await gql<{ listStudents: StudentConnection }>(query, undefined, tokenB);

    expect(resA.errors).toBeUndefined();
    expect(resB.errors).toBeUndefined();
    assert(resA.data);
    assert(resB.data);

    const nodesA = resA.data.listStudents.edges.map((e) => e.node);
    const nodesB = resB.data.listStudents.edges.map((e) => e.node);

    // Every row visible to tenant A is owned by tenant A
    expect(nodesA.every((n) => n.tenantId === tenantIdA)).toBe(true);
    expect(nodesB.every((n) => n.tenantId === tenantIdB)).toBe(true);

    // Zero ID overlap between the two result sets
    const idsA = new Set(nodesA.map((n) => n.id));
    for (const node of nodesB) {
      expect(
        idsA.has(node.id),
        `Student ${node.id} leaked from tenant B into tenant A's listStudents result`,
      ).toBe(false);
    }
  });

  it('tenant A sections are not visible to tenant B (sections)', async () => {
    const { accessToken: tokenA } = await loginAsInstituteAdmin(0);
    const { accessToken: tokenB } = await loginAsInstituteAdminSecondInstitute();

    // Each tenant has its own academic year → standards → sections chain.
    // Walk the chain as each tenant separately, then assert zero overlap.
    async function listSectionIds(token: string, academicYearId: string): Promise<Set<string>> {
      const standardsRes = await gql<{ standards: Array<{ id: string }> }>(
        `query Standards($academicYearId: ID!) {
          standards(academicYearId: $academicYearId) { id }
        }`,
        { academicYearId },
        token,
      );
      expect(standardsRes.errors).toBeUndefined();
      const standards = standardsRes.data?.standards ?? [];
      expect(standards.length).toBeGreaterThan(0);

      const sectionIds = new Set<string>();
      for (const { id: standardId } of standards) {
        const sectionsRes = await gql<{ sections: Array<{ id: string }> }>(
          `query Sections($standardId: ID!) {
            sections(standardId: $standardId) { id }
          }`,
          { standardId },
          token,
        );
        expect(sectionsRes.errors).toBeUndefined();
        const sections = sectionsRes.data?.sections ?? [];
        for (const s of sections) sectionIds.add(s.id);
      }
      return sectionIds;
    }

    const idsA = await listSectionIds(tokenA, SEED_IDS.ACADEMIC_YEAR_INST1);
    const idsB = await listSectionIds(tokenB, SEED_IDS.ACADEMIC_YEAR_INST2);

    // Both tenants must see at least one section — otherwise the test is
    // vacuously true.
    expect(idsA.size).toBeGreaterThan(0);
    expect(idsB.size).toBeGreaterThan(0);

    // Zero overlap — tenant A section IDs must not appear in B's result.
    for (const id of idsB) {
      expect(
        idsA.has(id),
        `Section ${id} leaked from tenant B into tenant A's sections result`,
      ).toBe(false);
    }

    // Tenant A must NOT be able to query sections via tenant B's standard ID.
    // We query one of tenant B's standards (which B sees) as tenant A —
    // expect either an empty/filtered result or a NOT_FOUND error. Either
    // way, tenant A must not receive any of tenant B's sections.
    const tenantBStandardsRes = await gql<{ standards: Array<{ id: string }> }>(
      `query Standards($academicYearId: ID!) {
        standards(academicYearId: $academicYearId) { id }
      }`,
      { academicYearId: SEED_IDS.ACADEMIC_YEAR_INST2 },
      tokenB,
    );
    const tenantBStandards = tenantBStandardsRes.data?.standards ?? [];
    if (tenantBStandards.length > 0) {
      const foreignStandardId = tenantBStandards[0].id;
      const crossRes = await gql<{ sections: Array<{ id: string }> }>(
        `query Sections($standardId: ID!) {
          sections(standardId: $standardId) { id }
        }`,
        { standardId: foreignStandardId },
        tokenA,
      );
      // Valid outcomes: (a) NOT_FOUND / empty (RLS hides the standard), or
      // (b) empty sections list. Tenant A must NOT receive B's sections.
      const leaked = crossRes.data?.sections ?? [];
      for (const s of leaked) {
        expect(
          idsB.has(s.id),
          `Section ${s.id} from tenant B was returned to tenant A via cross-tenant standardId lookup`,
        ).toBe(false);
      }
    }
  });

  it('tenant A audit logs are not visible to tenant B (auditLogs)', async () => {
    const { accessToken: tokenA, tenantId: tenantIdA } = await loginAsInstituteAdmin(0);
    const { accessToken: tokenB, tenantId: tenantIdB } =
      await loginAsInstituteAdminSecondInstitute();

    const query = `query {
      auditLogs(first: 100) {
        edges { node { id tenantId } }
      }
    }`;

    type AuditLogsData = {
      auditLogs: { edges: Array<{ node: { id: string; tenantId: string | null } }> };
    };
    const resA = await gql<AuditLogsData>(query, undefined, tokenA);
    const resB = await gql<AuditLogsData>(query, undefined, tokenB);

    expect(resA.errors).toBeUndefined();
    expect(resB.errors).toBeUndefined();
    assert(resA.data);
    assert(resB.data);

    const nodesA = resA.data.auditLogs.edges.map((e) => e.node);
    const nodesB = resB.data.auditLogs.edges.map((e) => e.node);

    // Every audit row visible to a tenant is either tenant-scoped to them
    // or platform-scoped (tenantId === null). Cross-tenant rows must NEVER appear.
    expect(nodesA.every((n) => n.tenantId === null || n.tenantId === tenantIdA)).toBe(true);
    expect(nodesB.every((n) => n.tenantId === null || n.tenantId === tenantIdB)).toBe(true);

    // No tenant-A-owned audit row should appear in tenant B's result and vice versa.
    const tenantAOnlyIds = new Set(nodesA.filter((n) => n.tenantId === tenantIdA).map((n) => n.id));
    for (const node of nodesB) {
      if (node.tenantId === tenantIdB) {
        expect(
          tenantAOnlyIds.has(node.id),
          `Audit log ${node.id} leaked from tenant A into tenant B's auditLogs result`,
        ).toBe(false);
      }
    }
  });
});
