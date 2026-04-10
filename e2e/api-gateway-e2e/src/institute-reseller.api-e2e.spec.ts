import assert from 'node:assert';
import type {
  InstituteConnection,
  InstituteGroupConnection,
  InstituteGroupModel,
  InstituteModel,
} from '@roviq/graphql/generated';
import { beforeAll, describe, expect, it } from 'vitest';

import { SEED_IDS } from '../../../scripts/seed-ids';
import { loginAsPlatformAdmin, loginAsReseller } from './helpers/auth';
import { gql } from './helpers/gql-client';

/**
 * Institute reseller-scope E2E (migrated from hurl/institute/11-13).
 *
 * Covers reseller-scoped resolvers:
 *   - resellerCreateInstituteRequest / resellerListInstitutes / resellerGetInstitute
 *   - resellerInstituteStatistics
 *   - resellerSuspendInstitute / resellerReactivateInstitute
 *   - resellerCreateInstituteGroup / resellerListInstituteGroups
 *
 * Cross-scope cleanup uses the platform admin token (e.g. adminApproveInstitute,
 * adminDeleteInstitute, adminDeleteInstituteGroup) to mirror the original Hurl flows.
 */

describe('Institute Reseller (reseller scope) E2E', () => {
  let resellerToken: string;
  let adminToken: string;

  beforeAll(async () => {
    const ping = await gql('{ __typename }');
    expect(ping.data?.__typename).toBe('Query');

    const reseller = await loginAsReseller();
    resellerToken = reseller.accessToken;

    const admin = await loginAsPlatformAdmin();
    adminToken = admin.accessToken;
  });

  // ─────────────────────────────────────────────────────────────
  // 11: resellerCreateInstituteRequest + admin approval
  // ─────────────────────────────────────────────────────────────
  describe('resellerCreateInstituteRequest', () => {
    it('creates a PENDING_APPROVAL request, lists/gets it, then admin approves it', async () => {
      // 1. Reseller creates the request
      const slug = `e2e-reseller-req-${Date.now()}`;
      const createRes = await gql<{ resellerCreateInstituteRequest: InstituteModel }>(
        `mutation ResellerCreate($input: ResellerCreateInstituteRequestInput!) {
          resellerCreateInstituteRequest(input: $input) {
            id name slug type status
          }
        }`,
        {
          input: {
            name: { en: 'Reseller Request E2E' },
            slug,
            type: 'SCHOOL',
            departments: ['PRIMARY', 'SECONDARY'],
          },
        },
        resellerToken,
      );
      expect(createRes.errors).toBeUndefined();
      assert(createRes.data);
      const id = createRes.data.resellerCreateInstituteRequest.id;
      expect(id).toBeDefined();
      expect(createRes.data.resellerCreateInstituteRequest.slug).toBe(slug);
      expect(createRes.data.resellerCreateInstituteRequest.status).toBe('PENDING_APPROVAL');

      // 2. List
      const listRes = await gql<{ resellerListInstitutes: InstituteConnection }>(
        `query {
          resellerListInstitutes {
            edges { node { id name slug status } }
            totalCount
          }
        }`,
        undefined,
        resellerToken,
      );
      expect(listRes.errors).toBeUndefined();
      expect(listRes.data?.resellerListInstitutes.totalCount).toBeGreaterThanOrEqual(1);

      // 3. Get by id
      const getRes = await gql<{ resellerGetInstitute: InstituteModel }>(
        `query Get($id: ID!) {
          resellerGetInstitute(id: $id) {
            id name slug status type structureFramework
          }
        }`,
        { id },
        resellerToken,
      );
      expect(getRes.errors).toBeUndefined();
      assert(getRes.data);
      expect(getRes.data.resellerGetInstitute.id).toBe(id);
      expect(getRes.data.resellerGetInstitute.status).toBe('PENDING_APPROVAL');

      // 4. Statistics
      const statsRes = await gql<{
        resellerInstituteStatistics: { totalInstitutes: number; byStatus: Record<string, number> };
      }>(
        `query { resellerInstituteStatistics { totalInstitutes byStatus } }`,
        undefined,
        resellerToken,
      );
      expect(statsRes.errors).toBeUndefined();
      expect(statsRes.data?.resellerInstituteStatistics).not.toBeNull();

      // 5. Admin approves — PENDING_APPROVAL → PENDING
      const approveRes = await gql<{ adminApproveInstitute: InstituteModel }>(
        `mutation Approve($id: ID!) {
          adminApproveInstitute(id: $id) { id status }
        }`,
        { id },
        adminToken,
      );
      expect(approveRes.errors).toBeUndefined();
      assert(approveRes.data);
      expect(approveRes.data.adminApproveInstitute.id).toBe(id);
      expect(approveRes.data.adminApproveInstitute.status).toBe('PENDING');

      // 6. Reseller sees the new status
      const verifyRes = await gql<{ resellerGetInstitute: InstituteModel }>(
        `query Get($id: ID!) {
          resellerGetInstitute(id: $id) { id status }
        }`,
        { id },
        resellerToken,
      );
      expect(verifyRes.errors).toBeUndefined();
      expect(verifyRes.data?.resellerGetInstitute.status).toBe('PENDING');

      // 7. Cleanup via admin
      const delRes = await gql<{ adminDeleteInstitute: boolean }>(
        `mutation Delete($id: ID!) { adminDeleteInstitute(id: $id) }`,
        { id },
        adminToken,
      );
      expect(delRes.errors).toBeUndefined();
      expect(delRes.data?.adminDeleteInstitute).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 12: resellerSuspendInstitute / resellerReactivateInstitute
  // ─────────────────────────────────────────────────────────────
  describe('resellerSuspend / resellerReactivate', () => {
    it('suspends and reactivates the seeded institute', async () => {
      const seedId = SEED_IDS.INSTITUTE_1;

      // verify ACTIVE
      const initialRes = await gql<{ resellerGetInstitute: InstituteModel }>(
        `query Get($id: ID!) { resellerGetInstitute(id: $id) { id status } }`,
        { id: seedId },
        resellerToken,
      );
      expect(initialRes.errors).toBeUndefined();
      expect(initialRes.data?.resellerGetInstitute.status).toBe('ACTIVE');

      // suspend
      const susRes = await gql<{ resellerSuspendInstitute: InstituteModel }>(
        `mutation Suspend($id: ID!, $reason: String) {
          resellerSuspendInstitute(id: $id, reason: $reason) { id status }
        }`,
        { id: seedId, reason: 'E2E test suspension' },
        resellerToken,
      );
      expect(susRes.errors).toBeUndefined();
      assert(susRes.data);
      expect(susRes.data.resellerSuspendInstitute.status).toBe('SUSPENDED');

      // verify
      const verSusRes = await gql<{ resellerGetInstitute: InstituteModel }>(
        `query Get($id: ID!) { resellerGetInstitute(id: $id) { id status } }`,
        { id: seedId },
        resellerToken,
      );
      expect(verSusRes.errors).toBeUndefined();
      expect(verSusRes.data?.resellerGetInstitute.status).toBe('SUSPENDED');

      // reactivate
      const reactRes = await gql<{ resellerReactivateInstitute: InstituteModel }>(
        `mutation Reactivate($id: ID!) {
          resellerReactivateInstitute(id: $id) { id status }
        }`,
        { id: seedId },
        resellerToken,
      );
      expect(reactRes.errors).toBeUndefined();
      assert(reactRes.data);
      expect(reactRes.data.resellerReactivateInstitute.status).toBe('ACTIVE');

      // final verify
      const verReactRes = await gql<{ resellerGetInstitute: InstituteModel }>(
        `query Get($id: ID!) { resellerGetInstitute(id: $id) { id status } }`,
        { id: seedId },
        resellerToken,
      );
      expect(verReactRes.errors).toBeUndefined();
      expect(verReactRes.data?.resellerGetInstitute.status).toBe('ACTIVE');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 13: resellerCreateInstituteGroup / resellerListInstituteGroups
  // ─────────────────────────────────────────────────────────────
  describe('reseller institute groups', () => {
    it('creates a group, lists groups, then admin cleans it up', async () => {
      const code = `reseller-e2e-group-${Date.now()}`;
      const createRes = await gql<{
        resellerCreateInstituteGroup: InstituteGroupModel;
      }>(
        `mutation Create($input: CreateInstituteGroupInput!) {
          resellerCreateInstituteGroup(input: $input) { id name code type }
        }`,
        {
          input: {
            name: 'Reseller E2E Group',
            code,
            type: 'SOCIETY',
          },
        },
        resellerToken,
      );
      expect(createRes.errors).toBeUndefined();
      assert(createRes.data);
      const created = createRes.data.resellerCreateInstituteGroup;
      const groupId = created.id;
      assert(typeof groupId === 'string');
      expect(created.name).toBe('Reseller E2E Group');
      expect(created.code).toBe(code);
      expect(created.type).toBe('SOCIETY');

      const listRes = await gql<{
        resellerListInstituteGroups: InstituteGroupConnection;
      }>(
        `query { resellerListInstituteGroups { edges { node { id name } } totalCount } }`,
        undefined,
        resellerToken,
      );
      expect(listRes.errors).toBeUndefined();
      expect(listRes.data?.resellerListInstituteGroups.totalCount).toBeGreaterThan(0);

      // admin cleanup
      const delRes = await gql<{ adminDeleteInstituteGroup: boolean }>(
        `mutation Delete($id: ID!) { adminDeleteInstituteGroup(id: $id) }`,
        { id: groupId },
        adminToken,
      );
      expect(delRes.errors).toBeUndefined();
      expect(delRes.data?.adminDeleteInstituteGroup).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Cross-scope rejection
  // ─────────────────────────────────────────────────────────────
  describe('cross-scope rejection', () => {
    it('rejects unauthenticated resellerListInstitutes', async () => {
      const res = await gql(`query { resellerListInstitutes { totalCount } }`);
      expect(res.errors).toBeDefined();
    });
  });
});
