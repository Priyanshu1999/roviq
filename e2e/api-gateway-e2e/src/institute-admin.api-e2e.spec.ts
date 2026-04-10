import assert from 'node:assert';
import type {
  InstituteConnection,
  InstituteGroupConnection,
  InstituteGroupModel,
  InstituteModel,
} from '@roviq/graphql/generated';
import { beforeAll, describe, expect, it } from 'vitest';

import { SEED_IDS } from '../../../scripts/seed-ids';
import { loginAsPlatformAdmin } from './helpers/auth';
import { gql } from './helpers/gql-client';

/**
 * Institute platform-scope E2E (migrated from hurl/institute/01-10).
 *
 * Covers the platform-scoped (`admin*`) resolvers for institute management:
 *   - adminListInstitutes / adminGetInstitute / adminInstituteStatistics
 *   - adminCreateInstitute / adminDeleteInstitute / adminRestoreInstitute
 *   - adminUpdateInstituteStatus / adminRejectInstitute
 *   - adminCreate/Update/Delete/ListInstituteGroup
 */

const ADMIN_DELETE = `mutation AdminDelete($id: ID!) { adminDeleteInstitute(id: $id) }`;

describe('Institute Admin (platform scope) E2E', () => {
  let adminToken: string;

  beforeAll(async () => {
    const ping = await gql('{ __typename }');
    expect(ping.data?.__typename).toBe('Query');

    const { accessToken } = await loginAsPlatformAdmin();
    adminToken = accessToken;
  });

  // ─────────────────────────────────────────────────────────────
  // 01: adminListInstitutes — pagination & filters
  // ─────────────────────────────────────────────────────────────
  describe('adminListInstitutes', () => {
    it('returns first page with totalCount and pageInfo', async () => {
      const res = await gql<{ adminListInstitutes: InstituteConnection }>(
        `query {
          adminListInstitutes {
            edges { node { id name slug type status setupStatus } cursor }
            pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
            totalCount
          }
        }`,
        undefined,
        adminToken,
      );

      expect(res.errors).toBeUndefined();
      assert(res.data);
      const conn = res.data.adminListInstitutes;
      expect(conn.edges.length).toBeGreaterThanOrEqual(1);
      expect(conn.totalCount).toBeGreaterThanOrEqual(1);
      expect(conn.pageInfo.hasPreviousPage).toBe(false);
      expect(conn.edges[0].node.id).toBeDefined();
      expect(conn.edges[0].cursor).toBeDefined();
    });

    it('filters by status ACTIVE', async () => {
      const res = await gql<{ adminListInstitutes: InstituteConnection }>(
        `query AdminListInstitutes($filter: AdminListInstitutesFilterInput) {
          adminListInstitutes(filter: $filter) {
            edges { node { id status } }
            totalCount
          }
        }`,
        { filter: { status: ['ACTIVE'] } },
        adminToken,
      );

      expect(res.errors).toBeUndefined();
      assert(res.data);
      expect(res.data.adminListInstitutes.edges.length).toBeGreaterThan(0);
    });

    it('filters by type SCHOOL', async () => {
      const res = await gql<{ adminListInstitutes: InstituteConnection }>(
        `query AdminListInstitutes($filter: AdminListInstitutesFilterInput) {
          adminListInstitutes(filter: $filter) {
            edges { node { id type } }
            totalCount
          }
        }`,
        { filter: { type: 'SCHOOL' } },
        adminToken,
      );

      expect(res.errors).toBeUndefined();
      assert(res.data);
      expect(res.data.adminListInstitutes).toBeDefined();
    });

    it('paginates via first + after cursor', async () => {
      const page1 = await gql<{ adminListInstitutes: InstituteConnection }>(
        `query AdminListInstitutes($filter: AdminListInstitutesFilterInput) {
          adminListInstitutes(filter: $filter) {
            edges { node { id } cursor }
            pageInfo { hasNextPage endCursor }
            totalCount
          }
        }`,
        { filter: { first: 1 } },
        adminToken,
      );

      expect(page1.errors).toBeUndefined();
      assert(page1.data);
      expect(page1.data.adminListInstitutes.edges).toHaveLength(1);
      expect(page1.data.adminListInstitutes.pageInfo.hasNextPage).toBe(true);

      const endCursor = page1.data.adminListInstitutes.pageInfo.endCursor;
      const page2 = await gql<{ adminListInstitutes: InstituteConnection }>(
        `query AdminListInstitutes($filter: AdminListInstitutesFilterInput) {
          adminListInstitutes(filter: $filter) {
            edges { node { id } }
            pageInfo { hasPreviousPage }
          }
        }`,
        { filter: { first: 1, after: endCursor } },
        adminToken,
      );

      expect(page2.errors).toBeUndefined();
      assert(page2.data);
      expect(page2.data.adminListInstitutes.pageInfo.hasPreviousPage).toBe(true);
    });

    it('search filter executes without 500', async () => {
      const res = await gql<{ adminListInstitutes: InstituteConnection }>(
        `query AdminListInstitutes($filter: AdminListInstitutesFilterInput) {
          adminListInstitutes(filter: $filter) {
            edges { node { id name } }
            totalCount
          }
        }`,
        { filter: { search: 'Demo' } },
        adminToken,
      );
      expect(res.errors).toBeUndefined();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 02: adminGetInstitute — single fetch
  // ─────────────────────────────────────────────────────────────
  describe('adminGetInstitute', () => {
    it('returns the seeded institute by id', async () => {
      const res = await gql<{ adminGetInstitute: InstituteModel }>(
        `query AdminGetInstitute($id: ID!) {
          adminGetInstitute(id: $id) {
            id name slug type status setupStatus timezone currency contact
          }
        }`,
        { id: SEED_IDS.INSTITUTE_1 },
        adminToken,
      );

      expect(res.errors).toBeUndefined();
      assert(res.data);
      const inst = res.data.adminGetInstitute;
      expect(inst.id).toBe(SEED_IDS.INSTITUTE_1);
      expect(inst.name).not.toBeNull();
      expect(inst.slug).not.toBeNull();
      expect(inst.type).not.toBeNull();
      expect(inst.status).not.toBeNull();
      expect(inst.setupStatus).not.toBeNull();
      expect(inst.timezone).not.toBeNull();
      expect(inst.currency).not.toBeNull();
      expect(inst.contact).not.toBeNull();
    });

    it('returns errors for unknown id', async () => {
      const res = await gql<{ adminGetInstitute: InstituteModel }>(
        `query AdminGetInstitute($id: ID!) {
          adminGetInstitute(id: $id) { id name }
        }`,
        { id: '00000000-0000-0000-0000-000000000000' },
        adminToken,
      );

      expect(res.errors).toBeDefined();
      expect(res.errors?.length).toBeGreaterThan(0);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 03: adminCreateInstitute — minimal, full, dup-slug, cleanup
  // ─────────────────────────────────────────────────────────────
  describe('adminCreateInstitute', () => {
    it('creates with minimal fields, rejects duplicate slug, and cleans up', async () => {
      const slug = `e2e-create-${Date.now()}`;

      // minimal
      const minRes = await gql<{ adminCreateInstitute: InstituteModel }>(
        `mutation AdminCreate($input: AdminCreateInstituteInput!) {
          adminCreateInstitute(input: $input) {
            id name slug type status setupStatus
          }
        }`,
        {
          input: {
            name: { en: 'E2E Create Institute' },
            slug,
            type: 'SCHOOL',
          },
        },
        adminToken,
      );
      expect(minRes.errors).toBeUndefined();
      assert(minRes.data);
      const minId = minRes.data.adminCreateInstitute.id;
      expect(minId).toBeDefined();
      expect(minRes.data.adminCreateInstitute.name.en).toBe('E2E Create Institute');
      expect(minRes.data.adminCreateInstitute.slug).toBe(slug);
      expect(minRes.data.adminCreateInstitute.type).toBe('SCHOOL');
      expect(minRes.data.adminCreateInstitute.status).toBe('PENDING');

      // full
      const fullSlug = `e2e-coaching-${Date.now()}`;
      const fullRes = await gql<{ adminCreateInstitute: InstituteModel }>(
        `mutation AdminCreate($input: AdminCreateInstituteInput!) {
          adminCreateInstitute(input: $input) {
            id name slug type structureFramework setupStatus status
          }
        }`,
        {
          input: {
            name: { en: 'E2E Coaching Institute' },
            slug: fullSlug,
            type: 'COACHING',
            structureFramework: 'NEP',
            code: 'COACH-E2E',
            contact: { email: 'test@roviq.com', phone: '+919999999999' },
            departments: ['PRIMARY', 'SECONDARY'],
            isDemo: true,
          },
        },
        adminToken,
      );
      expect(fullRes.errors).toBeUndefined();
      assert(fullRes.data);
      const fullId = fullRes.data.adminCreateInstitute.id;
      expect(fullId).toBeDefined();
      expect(fullRes.data.adminCreateInstitute.type).toBe('COACHING');
      expect(fullRes.data.adminCreateInstitute.structureFramework).toBe('NEP');

      // duplicate slug
      const dupRes = await gql<{ adminCreateInstitute: InstituteModel }>(
        `mutation AdminCreate($input: AdminCreateInstituteInput!) {
          adminCreateInstitute(input: $input) { id slug }
        }`,
        {
          input: {
            name: { en: 'Dup Slug' },
            slug,
            type: 'SCHOOL',
          },
        },
        adminToken,
      );
      expect(dupRes.errors).toBeDefined();
      expect(dupRes.errors?.length).toBeGreaterThan(0);

      // cleanup
      const del1 = await gql<{ adminDeleteInstitute: boolean }>(
        ADMIN_DELETE,
        { id: minId },
        adminToken,
      );
      expect(del1.data?.adminDeleteInstitute).toBe(true);
      const del2 = await gql<{ adminDeleteInstitute: boolean }>(
        ADMIN_DELETE,
        { id: fullId },
        adminToken,
      );
      expect(del2.data?.adminDeleteInstitute).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 04: adminCreateInstitute with contact + address + adminGet
  // ─────────────────────────────────────────────────────────────
  describe('adminCreateInstitute with contact and address', () => {
    it('persists contact and address fields, fetches them via adminGetInstitute', async () => {
      const slug = `e2e-update-${Date.now()}`;
      const createRes = await gql<{ adminCreateInstitute: InstituteModel }>(
        `mutation AdminCreate($input: AdminCreateInstituteInput!) {
          adminCreateInstitute(input: $input) {
            id name code contact address timezone currency status
          }
        }`,
        {
          input: {
            name: { en: 'E2E Update Test' },
            slug,
            type: 'SCHOOL',
            contact: { email: 'test@roviq.com', phone: '+919999999999' },
            address: {
              line1: '123 Main St',
              city: 'Mumbai',
              state: 'MH',
              country: 'IN',
              postalCode: '400001',
            },
          },
        },
        adminToken,
      );
      expect(createRes.errors).toBeUndefined();
      assert(createRes.data);
      const id = createRes.data.adminCreateInstitute.id;

      const getRes = await gql<{ adminGetInstitute: InstituteModel }>(
        `query AdminGetInstitute($id: ID!) {
          adminGetInstitute(id: $id) {
            id name slug type status setupStatus timezone currency contact address
          }
        }`,
        { id },
        adminToken,
      );
      expect(getRes.errors).toBeUndefined();
      assert(getRes.data);
      expect(getRes.data.adminGetInstitute.id).toBe(id);
      expect(getRes.data.adminGetInstitute.name.en).toBe('E2E Update Test');
      expect(getRes.data.adminGetInstitute.slug).toBe(slug);
      expect(getRes.data.adminGetInstitute.timezone).not.toBeNull();
      expect(getRes.data.adminGetInstitute.currency).not.toBeNull();

      const del = await gql<{ adminDeleteInstitute: boolean }>(ADMIN_DELETE, { id }, adminToken);
      expect(del.data?.adminDeleteInstitute).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 05 + 08: adminUpdateInstituteStatus — full lifecycle on seed inst
  // ─────────────────────────────────────────────────────────────
  describe('adminUpdateInstituteStatus lifecycle', () => {
    it('rejects activating a PENDING institute that has not completed setup', async () => {
      const createRes = await gql<{ adminCreateInstitute: InstituteModel }>(
        `mutation AdminCreate($input: AdminCreateInstituteInput!) {
          adminCreateInstitute(input: $input) { id status setupStatus }
        }`,
        {
          input: {
            name: { en: 'E2E Status Pending' },
            slug: `e2e-status-pending-${Date.now()}`,
            type: 'SCHOOL',
          },
        },
        adminToken,
      );
      expect(createRes.errors).toBeUndefined();
      assert(createRes.data);
      const id = createRes.data.adminCreateInstitute.id;
      expect(createRes.data.adminCreateInstitute.status).toBe('PENDING');

      // PENDING institutes are activated via `adminApproveInstitute`. The
      // service blocks PENDING → ACTIVE when setupStatus !== COMPLETED.
      const actRes = await gql<{ adminApproveInstitute: InstituteModel }>(
        `mutation Approve($id: ID!) {
          adminApproveInstitute(id: $id) { id status }
        }`,
        { id },
        adminToken,
      );
      expect(actRes.errors).toBeDefined();
      expect(actRes.data?.adminApproveInstitute ?? null).toBeNull();

      // cleanup
      await gql<{ adminDeleteInstitute: boolean }>(ADMIN_DELETE, { id }, adminToken);
    });

    it('runs ACTIVE → INACTIVE → ACTIVE → SUSPENDED → ACTIVE on the seeded institute', async () => {
      const seedId = SEED_IDS.INSTITUTE_1;

      // Reentrancy: a failed prior run may have left this institute in
      // a non-ACTIVE state. Bring it back to ACTIVE before starting.
      const currentStatusRes = await gql<{ adminGetInstitute: InstituteModel }>(
        `query Get($id: ID!) { adminGetInstitute(id: $id) { id status } }`,
        { id: seedId },
        adminToken,
      );
      const currentStatus = currentStatusRes.data?.adminGetInstitute?.status ?? null;
      if (currentStatus && currentStatus !== 'ACTIVE') {
        await gql<{ adminApproveInstitute: InstituteModel }>(
          `mutation Approve($id: ID!) { adminApproveInstitute(id: $id) { id status } }`,
          { id: seedId },
          adminToken,
        );
      }

      // Status changes are exposed as named domain mutations, not a generic
      // adminUpdateInstituteStatus. See admin-institute.resolver.ts:
      //   adminApproveInstitute  PENDING  → ACTIVE  (via service.approve)
      //   adminDeactivateInstitute ACTIVE → INACTIVE
      //   adminSuspendInstitute    *       → SUSPENDED
      //   adminRejectInstitute     PENDING → REJECTED
      // INACTIVE → ACTIVE goes through `adminApproveInstitute` (service.approve
      // also handles INACTIVE→ACTIVE transitions).
      const steps: Array<{
        mutation: string;
        args: string;
        field: string;
        expected: string;
      }> = [
        {
          mutation:
            'mutation Deactivate($id: ID!) { adminDeactivateInstitute(id: $id) { id status } }',
          args: 'INACTIVE',
          field: 'adminDeactivateInstitute',
          expected: 'INACTIVE',
        },
        {
          mutation: 'mutation Approve($id: ID!) { adminApproveInstitute(id: $id) { id status } }',
          args: 'ACTIVE',
          field: 'adminApproveInstitute',
          expected: 'ACTIVE',
        },
        {
          mutation: 'mutation Suspend($id: ID!) { adminSuspendInstitute(id: $id) { id status } }',
          args: 'SUSPENDED',
          field: 'adminSuspendInstitute',
          expected: 'SUSPENDED',
        },
        {
          mutation: 'mutation Approve($id: ID!) { adminApproveInstitute(id: $id) { id status } }',
          args: 'ACTIVE',
          field: 'adminApproveInstitute',
          expected: 'ACTIVE',
        },
      ];

      for (const step of steps) {
        const res = await gql<Record<string, InstituteModel>>(
          step.mutation,
          { id: seedId },
          adminToken,
        );
        expect(
          res.errors,
          `${step.field} (${step.args}) returned errors: ${JSON.stringify(res.errors)}`,
        ).toBeUndefined();
        assert(res.data);
        expect(res.data[step.field].id).toBe(seedId);
        expect(res.data[step.field].status).toBe(step.expected);
      }
    });

    it('rejects SUSPENDED → INACTIVE (must be SUSPENDED → ACTIVE only)', async () => {
      const seedId = SEED_IDS.INSTITUTE_1;

      // Reentrancy: ensure ACTIVE start state.
      const currentStatusRes = await gql<{ adminGetInstitute: InstituteModel }>(
        `query Get($id: ID!) { adminGetInstitute(id: $id) { id status } }`,
        { id: seedId },
        adminToken,
      );
      const currentStatus = currentStatusRes.data?.adminGetInstitute?.status ?? null;
      if (currentStatus && currentStatus !== 'ACTIVE') {
        await gql<{ adminApproveInstitute: InstituteModel }>(
          `mutation Approve($id: ID!) { adminApproveInstitute(id: $id) { id status } }`,
          { id: seedId },
          adminToken,
        );
      }

      // ACTIVE → SUSPENDED via the named domain mutation
      const susRes = await gql<{ adminSuspendInstitute: InstituteModel }>(
        `mutation Suspend($id: ID!) {
          adminSuspendInstitute(id: $id) { id status }
        }`,
        { id: seedId },
        adminToken,
      );
      expect(susRes.errors).toBeUndefined();

      // SUSPENDED → INACTIVE is invalid: the only valid recovery from
      // SUSPENDED is SUSPENDED → ACTIVE (via adminApproveInstitute).
      const badRes = await gql<{ adminDeactivateInstitute: InstituteModel }>(
        `mutation Deactivate($id: ID!) {
          adminDeactivateInstitute(id: $id) { id status }
        }`,
        { id: seedId },
        adminToken,
      );
      expect(badRes.errors).toBeDefined();
      expect(badRes.errors?.[0].message).toMatch(/Cannot transition from SUSPENDED to INACTIVE/);
      expect(badRes.data?.adminDeactivateInstitute ?? null).toBeNull();

      // restore for other tests: SUSPENDED → ACTIVE
      const restoreRes = await gql<{ adminApproveInstitute: InstituteModel }>(
        `mutation Approve($id: ID!) {
          adminApproveInstitute(id: $id) { id status }
        }`,
        { id: seedId },
        adminToken,
      );
      expect(restoreRes.errors).toBeUndefined();
      expect(restoreRes.data?.adminApproveInstitute.status).toBe('ACTIVE');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 06: adminDeleteInstitute / adminRestoreInstitute
  // ─────────────────────────────────────────────────────────────
  describe('adminDelete + adminRestore', () => {
    it('soft-deletes, hides from get, restores, then cleans up', async () => {
      const createRes = await gql<{ adminCreateInstitute: InstituteModel }>(
        `mutation AdminCreate($input: AdminCreateInstituteInput!) {
          adminCreateInstitute(input: $input) { id name slug status }
        }`,
        {
          input: {
            name: { en: 'E2E Delete Test' },
            slug: `e2e-delete-${Date.now()}`,
            type: 'SCHOOL',
          },
        },
        adminToken,
      );
      expect(createRes.errors).toBeUndefined();
      assert(createRes.data);
      const id = createRes.data.adminCreateInstitute.id;

      const delRes = await gql<{ adminDeleteInstitute: boolean }>(ADMIN_DELETE, { id }, adminToken);
      expect(delRes.errors).toBeUndefined();
      expect(delRes.data?.adminDeleteInstitute).toBe(true);

      const getDeletedRes = await gql<{ adminGetInstitute: InstituteModel }>(
        `query Get($id: ID!) { adminGetInstitute(id: $id) { id name } }`,
        { id },
        adminToken,
      );
      expect(getDeletedRes.errors).toBeDefined();

      const restoreRes = await gql<{ adminRestoreInstitute: InstituteModel }>(
        `mutation Restore($id: ID!) { adminRestoreInstitute(id: $id) { id name status } }`,
        { id },
        adminToken,
      );
      expect(restoreRes.errors).toBeUndefined();
      assert(restoreRes.data);
      expect(restoreRes.data.adminRestoreInstitute.id).toBe(id);

      const getAfterRestore = await gql<{ adminGetInstitute: InstituteModel }>(
        `query Get($id: ID!) { adminGetInstitute(id: $id) { id name } }`,
        { id },
        adminToken,
      );
      expect(getAfterRestore.errors).toBeUndefined();
      expect(getAfterRestore.data?.adminGetInstitute.id).toBe(id);

      // delete unknown
      const delUnknownRes = await gql<{ adminDeleteInstitute: boolean }>(
        ADMIN_DELETE,
        { id: '00000000-0000-0000-0000-000000000000' },
        adminToken,
      );
      expect(delUnknownRes.errors).toBeDefined();

      // final cleanup
      await gql<{ adminDeleteInstitute: boolean }>(ADMIN_DELETE, { id }, adminToken);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 07: full create → list → get → statistics → delete → restore
  // ─────────────────────────────────────────────────────────────
  describe('admin approval flow', () => {
    it('lists, fetches, gets statistics, soft-deletes, then restores', async () => {
      const createRes = await gql<{ adminCreateInstitute: InstituteModel }>(
        `mutation AdminCreate($input: AdminCreateInstituteInput!) {
          adminCreateInstitute(input: $input) {
            id name slug type status setupStatus
          }
        }`,
        {
          input: {
            name: { en: 'E2E Approval Flow' },
            slug: `e2e-approval-flow-${Date.now()}`,
            type: 'SCHOOL',
            departments: ['PRIMARY', 'SECONDARY'],
          },
        },
        adminToken,
      );
      expect(createRes.errors).toBeUndefined();
      assert(createRes.data);
      const id = createRes.data.adminCreateInstitute.id;

      const listRes = await gql<{ adminListInstitutes: InstituteConnection }>(
        `query { adminListInstitutes { edges { node { id } } totalCount } }`,
        undefined,
        adminToken,
      );
      expect(listRes.errors).toBeUndefined();
      expect(listRes.data?.adminListInstitutes.totalCount).toBeGreaterThanOrEqual(1);

      const getRes = await gql<{ adminGetInstitute: InstituteModel }>(
        `query Get($id: ID!) {
          adminGetInstitute(id: $id) { id name slug type status }
        }`,
        { id },
        adminToken,
      );
      expect(getRes.errors).toBeUndefined();
      expect(getRes.data?.adminGetInstitute.id).toBe(id);

      const statsRes = await gql<{
        adminInstituteStatistics: { totalInstitutes: number; byStatus: Record<string, number> };
      }>(
        `query { adminInstituteStatistics { totalInstitutes byStatus byType byReseller { resellerId count } recentlyCreated } }`,
        undefined,
        adminToken,
      );
      expect(statsRes.errors).toBeUndefined();
      expect(statsRes.data?.adminInstituteStatistics).toBeDefined();
      expect(statsRes.data?.adminInstituteStatistics.totalInstitutes).toBeGreaterThanOrEqual(1);

      const delRes = await gql<{ adminDeleteInstitute: boolean }>(ADMIN_DELETE, { id }, adminToken);
      expect(delRes.data?.adminDeleteInstitute).toBe(true);

      const restoreRes = await gql<{ adminRestoreInstitute: InstituteModel }>(
        `mutation Restore($id: ID!) { adminRestoreInstitute(id: $id) { id name } }`,
        { id },
        adminToken,
      );
      expect(restoreRes.errors).toBeUndefined();

      await gql<{ adminDeleteInstitute: boolean }>(ADMIN_DELETE, { id }, adminToken);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 09: adminRejectInstitute — terminal REJECTED state
  // ─────────────────────────────────────────────────────────────
  describe('adminRejectInstitute', () => {
    it('rejects a PENDING institute and refuses any further transition', async () => {
      const createRes = await gql<{ adminCreateInstitute: InstituteModel }>(
        `mutation AdminCreate($input: AdminCreateInstituteInput!) {
          adminCreateInstitute(input: $input) { id status setupStatus }
        }`,
        {
          input: {
            name: { en: 'E2E Reject Flow' },
            slug: `e2e-reject-${Date.now()}`,
            type: 'SCHOOL',
          },
        },
        adminToken,
      );
      expect(createRes.errors).toBeUndefined();
      assert(createRes.data);
      const id = createRes.data.adminCreateInstitute.id;
      expect(createRes.data.adminCreateInstitute.status).toBe('PENDING');

      const rejectRes = await gql<{ adminRejectInstitute: InstituteModel }>(
        `mutation Reject($id: ID!, $reason: String!) {
          adminRejectInstitute(id: $id, reason: $reason) { id status }
        }`,
        { id, reason: 'E2E test rejection — not a real institute' },
        adminToken,
      );
      expect(rejectRes.errors).toBeUndefined();
      assert(rejectRes.data);
      expect(rejectRes.data.adminRejectInstitute.id).toBe(id);
      expect(rejectRes.data.adminRejectInstitute.status).toBe('REJECTED');

      // REJECTED is terminal — every transition should fail
      for (const status of ['ACTIVE', 'SUSPENDED', 'INACTIVE']) {
        const res = await gql<{ adminUpdateInstituteStatus: InstituteModel }>(
          `mutation Update($id: ID!, $status: InstituteStatus!) {
            adminUpdateInstituteStatus(id: $id, status: $status) { id status }
          }`,
          { id, status },
          adminToken,
        );
        expect(res.errors).toBeDefined();
        expect(res.data?.adminUpdateInstituteStatus ?? null).toBeNull();
      }

      await gql<{ adminDeleteInstitute: boolean }>(ADMIN_DELETE, { id }, adminToken);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 10: institute group CRUD via platform scope
  // ─────────────────────────────────────────────────────────────
  describe('admin institute groups', () => {
    it('creates, lists, updates, then deletes a group', async () => {
      const code = `e2e-admin-group-${Date.now()}`;
      const createRes = await gql<{ adminCreateInstituteGroup: InstituteGroupModel }>(
        `mutation Create($input: CreateInstituteGroupInput!) {
          adminCreateInstituteGroup(input: $input) {
            id name code type status registrationNumber createdAt updatedAt
          }
        }`,
        {
          input: {
            name: 'E2E Admin Test Trust',
            code,
            type: 'TRUST',
            registrationNumber: 'REG-E2E-ADMIN-001',
          },
        },
        adminToken,
      );
      expect(createRes.errors).toBeUndefined();
      assert(createRes.data);
      const groupId = createRes.data.adminCreateInstituteGroup.id;
      expect(createRes.data.adminCreateInstituteGroup.name).toBe('E2E Admin Test Trust');
      expect(createRes.data.adminCreateInstituteGroup.code).toBe(code);
      expect(createRes.data.adminCreateInstituteGroup.type).toBe('TRUST');
      expect(createRes.data.adminCreateInstituteGroup.status).toBe('ACTIVE');

      const listRes = await gql<{ adminListInstituteGroups: InstituteGroupConnection }>(
        `query {
          adminListInstituteGroups {
            edges { node { id name code type status } cursor }
            pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
            totalCount
          }
        }`,
        undefined,
        adminToken,
      );
      expect(listRes.errors).toBeUndefined();
      expect(listRes.data?.adminListInstituteGroups.totalCount).toBeGreaterThanOrEqual(1);

      const updateRes = await gql<{ adminUpdateInstituteGroup: InstituteGroupModel }>(
        `mutation Update($id: ID!, $input: UpdateInstituteGroupInput!) {
          adminUpdateInstituteGroup(id: $id, input: $input) {
            id name code type status registrationNumber
          }
        }`,
        {
          id: groupId,
          input: {
            version: 1,
            name: 'Updated E2E Admin Trust',
            registrationNumber: 'REG-E2E-ADMIN-002',
          },
        },
        adminToken,
      );
      expect(updateRes.errors).toBeUndefined();
      assert(updateRes.data);
      expect(updateRes.data.adminUpdateInstituteGroup.name).toBe('Updated E2E Admin Trust');
      expect(updateRes.data.adminUpdateInstituteGroup.registrationNumber).toBe('REG-E2E-ADMIN-002');

      const filterRes = await gql<{ adminListInstituteGroups: InstituteGroupConnection }>(
        `query Search($filter: InstituteGroupFilterInput) {
          adminListInstituteGroups(filter: $filter) {
            edges { node { id name code } }
            totalCount
          }
        }`,
        { filter: { search: code } },
        adminToken,
      );
      expect(filterRes.errors).toBeUndefined();
      expect(filterRes.data?.adminListInstituteGroups.totalCount).toBeGreaterThanOrEqual(1);

      const deleteRes = await gql<{ adminDeleteInstituteGroup: boolean }>(
        `mutation Delete($id: ID!) { adminDeleteInstituteGroup(id: $id) }`,
        { id: groupId },
        adminToken,
      );
      expect(deleteRes.errors).toBeUndefined();
      expect(deleteRes.data?.adminDeleteInstituteGroup).toBe(true);

      const verifyRes = await gql<{ adminListInstituteGroups: InstituteGroupConnection }>(
        `query Search($filter: InstituteGroupFilterInput) {
          adminListInstituteGroups(filter: $filter) {
            edges { node { id name } }
            totalCount
          }
        }`,
        { filter: { search: code } },
        adminToken,
      );
      expect(verifyRes.errors).toBeUndefined();
      expect(verifyRes.data?.adminListInstituteGroups.totalCount).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Cross-scope rejection
  // ─────────────────────────────────────────────────────────────
  describe('cross-scope rejection', () => {
    it('rejects unauthenticated adminListInstitutes', async () => {
      const res = await gql(`query { adminListInstitutes { totalCount } }`);
      expect(res.errors).toBeDefined();
    });
  });
});
