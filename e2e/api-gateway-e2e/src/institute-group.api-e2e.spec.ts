/**
 * Institute Group domain E2E tests — migrated from
 *   e2e/api-gateway-e2e/hurl/institute-group/*.hurl
 *
 * Covers the 4 Hurl scenarios:
 *   01-crud-institute-group — adminCreate / adminUpdate / adminList / adminDelete
 *                             (@PlatformScope — admin token)
 *   02-status-transitions   — create / deactivate / activate / suspend / delete
 *                             (@InstituteScope — institute-admin token)
 *   03-institute-linking    — create / addInstituteToGroup /
 *                             removeInstituteFromGroup / delete
 *                             (@InstituteScope — institute-admin token)
 *   04-not-found-errors     — adminDelete with zero-UUID returns errors
 *                             (@PlatformScope — admin token)
 *
 * Scope fix vs. Hurl: the Hurl suites for 02 and 03 used `{{admin_token}}`
 * against the non-admin (InstituteScope) resolver, which would be rejected
 * as FORBIDDEN by the scope guard. We authenticate those scenarios with
 * `loginAsInstituteAdmin()` so they actually exercise the intended
 * `InstituteGroupResolver` path.
 */
import assert from 'node:assert';
import { GroupStatus, GroupType } from '@roviq/common-types';
import { beforeAll, describe, expect, it } from 'vitest';
import { SEED } from '../../shared/seed';
import { loginAsInstituteAdmin, loginAsPlatformAdmin } from './helpers/auth';
import { gql } from './helpers/gql-client';

interface InstituteGroupNode {
  id: string;
  name: string;
  code: string;
  type: GroupType;
  status: GroupStatus;
  registrationNumber: string | null;
}

interface InstituteGroupEdge {
  node: Pick<InstituteGroupNode, 'id' | 'name' | 'code' | 'type' | 'status'>;
  cursor: string;
}

interface InstituteGroupConnection {
  edges: InstituteGroupEdge[];
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: string | null;
    endCursor: string | null;
  };
  totalCount: number;
}

// Short unique suffix to avoid `code` collisions across retries / parallel
// workers — `code` has a unique index.
const SUFFIX = Date.now().toString(36);

describe('Institute Group E2E', () => {
  let adminToken: string;
  let instituteAdminToken: string;

  beforeAll(async () => {
    adminToken = (await loginAsPlatformAdmin()).accessToken;
    instituteAdminToken = (await loginAsInstituteAdmin()).accessToken;
  });

  // ─────────────────────────────────────────────────────
  // 01 — Admin CRUD lifecycle (@PlatformScope)
  // ─────────────────────────────────────────────────────
  describe('admin CRUD lifecycle', () => {
    it('create → update → list → delete', async () => {
      const code = `test-trust-${SUFFIX}`;

      // create
      const createRes = await gql<{ adminCreateInstituteGroup: InstituteGroupNode }>(
        `mutation AdminCreate($input: CreateInstituteGroupInput!) {
          adminCreateInstituteGroup(input: $input) {
            id name code type status registrationNumber
          }
        }`,
        { input: { name: 'Test Trust', code, type: GroupType.TRUST } },
        adminToken,
      );
      expect(createRes.errors).toBeUndefined();
      const created = createRes.data?.adminCreateInstituteGroup;
      assert(created);
      expect(created.id).toBeTruthy();
      expect(created.name).toBe('Test Trust');
      expect(created.code).toBe(code);
      expect(created.type).toBe(GroupType.TRUST);
      expect(created.status).toBe(GroupStatus.ACTIVE);

      const groupId = created.id;

      // update (version: 1 — first update bumps 1 → 2)
      const updateRes = await gql<{ adminUpdateInstituteGroup: InstituteGroupNode }>(
        `mutation AdminUpdate($id: ID!, $input: UpdateInstituteGroupInput!) {
          adminUpdateInstituteGroup(id: $id, input: $input) {
            id name code type status registrationNumber
          }
        }`,
        {
          id: groupId,
          input: {
            version: 1,
            name: 'Updated Trust',
            registrationNumber: 'REG-2026-001',
          },
        },
        adminToken,
      );
      expect(updateRes.errors).toBeUndefined();
      const updated = updateRes.data?.adminUpdateInstituteGroup;
      assert(updated);
      expect(updated.id).toBe(groupId);
      expect(updated.name).toBe('Updated Trust');
      expect(updated.registrationNumber).toBe('REG-2026-001');
      expect(updated.code).toBe(code);
      expect(updated.type).toBe(GroupType.TRUST);

      // list (no filter) — the row must appear
      const listRes = await gql<{ adminListInstituteGroups: InstituteGroupConnection }>(
        `query AdminList {
          adminListInstituteGroups {
            edges { node { id name code type status } cursor }
            pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
            totalCount
          }
        }`,
        {},
        adminToken,
      );
      expect(listRes.errors).toBeUndefined();
      const connection = listRes.data?.adminListInstituteGroups;
      assert(connection);
      expect(connection.totalCount).toBeGreaterThanOrEqual(1);
      expect(connection.edges.length).toBeGreaterThanOrEqual(1);
      const ids = connection.edges.map((e) => e.node.id);
      expect(ids).toContain(groupId);

      // list (search filter)
      const filteredRes = await gql<{ adminListInstituteGroups: InstituteGroupConnection }>(
        `query AdminList($filter: InstituteGroupFilterInput) {
          adminListInstituteGroups(filter: $filter) {
            edges { node { id name code } cursor }
            pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
            totalCount
          }
        }`,
        { filter: { search: code } },
        adminToken,
      );
      expect(filteredRes.errors).toBeUndefined();
      const filtered = filteredRes.data?.adminListInstituteGroups;
      assert(filtered);
      expect(filtered.totalCount).toBeGreaterThanOrEqual(1);

      // delete
      const deleteRes = await gql<{ adminDeleteInstituteGroup: boolean }>(
        `mutation AdminDelete($id: ID!) { adminDeleteInstituteGroup(id: $id) }`,
        { id: groupId },
        adminToken,
      );
      expect(deleteRes.errors).toBeUndefined();
      expect(deleteRes.data?.adminDeleteInstituteGroup).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────
  // 02 — Status transitions (@InstituteScope)
  // ─────────────────────────────────────────────────────
  describe('status transitions', () => {
    it('ACTIVE → INACTIVE → ACTIVE → SUSPENDED → ACTIVE → delete', async () => {
      const code = `chain-status-${SUFFIX}`;

      // create
      const createRes = await gql<{ createInstituteGroup: InstituteGroupNode }>(
        `mutation CreateInstituteGroup($input: CreateInstituteGroupInput!) {
          createInstituteGroup(input: $input) { id name code type status }
        }`,
        { input: { name: 'Chain Status Test', code, type: GroupType.CHAIN } },
        instituteAdminToken,
      );
      expect(createRes.errors).toBeUndefined();
      const created = createRes.data?.createInstituteGroup;
      assert(created);
      expect(created.status).toBe(GroupStatus.ACTIVE);
      const groupId = created.id;

      // deactivate
      const deactivateRes = await gql<{ deactivateInstituteGroup: InstituteGroupNode }>(
        `mutation Deactivate($id: ID!) {
          deactivateInstituteGroup(id: $id) { id status }
        }`,
        { id: groupId },
        instituteAdminToken,
      );
      expect(deactivateRes.errors).toBeUndefined();
      expect(deactivateRes.data?.deactivateInstituteGroup.id).toBe(groupId);
      expect(deactivateRes.data?.deactivateInstituteGroup.status).toBe(GroupStatus.INACTIVE);

      // activate (INACTIVE → ACTIVE)
      const activateRes = await gql<{ activateInstituteGroup: InstituteGroupNode }>(
        `mutation Activate($id: ID!) {
          activateInstituteGroup(id: $id) { id status }
        }`,
        { id: groupId },
        instituteAdminToken,
      );
      expect(activateRes.errors).toBeUndefined();
      expect(activateRes.data?.activateInstituteGroup.status).toBe(GroupStatus.ACTIVE);

      // suspend
      const suspendRes = await gql<{ suspendInstituteGroup: InstituteGroupNode }>(
        `mutation Suspend($id: ID!) {
          suspendInstituteGroup(id: $id) { id status }
        }`,
        { id: groupId },
        instituteAdminToken,
      );
      expect(suspendRes.errors).toBeUndefined();
      expect(suspendRes.data?.suspendInstituteGroup.status).toBe(GroupStatus.SUSPENDED);

      // activate (SUSPENDED → ACTIVE)
      const reactivateRes = await gql<{ activateInstituteGroup: InstituteGroupNode }>(
        `mutation Activate($id: ID!) {
          activateInstituteGroup(id: $id) { id status }
        }`,
        { id: groupId },
        instituteAdminToken,
      );
      expect(reactivateRes.errors).toBeUndefined();
      expect(reactivateRes.data?.activateInstituteGroup.status).toBe(GroupStatus.ACTIVE);

      // delete (cleanup)
      const deleteRes = await gql<{ deleteInstituteGroup: boolean }>(
        `mutation Delete($id: ID!) { deleteInstituteGroup(id: $id) }`,
        { id: groupId },
        instituteAdminToken,
      );
      expect(deleteRes.errors).toBeUndefined();
      expect(deleteRes.data?.deleteInstituteGroup).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────
  // 03 — Institute linking (@InstituteScope)
  // ─────────────────────────────────────────────────────
  describe('institute linking', () => {
    it('create group → add institute_1 → add institute_2 → remove institute_1 → cleanup', async () => {
      const code = `society-link-${SUFFIX}`;

      // create group
      const createRes = await gql<{ createInstituteGroup: InstituteGroupNode }>(
        `mutation CreateInstituteGroup($input: CreateInstituteGroupInput!) {
          createInstituteGroup(input: $input) { id name code type status }
        }`,
        { input: { name: 'Society Link Test', code, type: GroupType.SOCIETY } },
        instituteAdminToken,
      );
      expect(createRes.errors).toBeUndefined();
      const created = createRes.data?.createInstituteGroup;
      assert(created);
      expect(created.type).toBe(GroupType.SOCIETY);
      expect(created.status).toBe(GroupStatus.ACTIVE);
      const groupId = created.id;

      try {
        // add institute_1
        const add1Res = await gql<{ addInstituteToGroup: boolean }>(
          `mutation AddToGroup($instituteId: ID!, $groupId: ID!) {
            addInstituteToGroup(instituteId: $instituteId, groupId: $groupId)
          }`,
          { instituteId: SEED.INSTITUTE_1.id, groupId },
          instituteAdminToken,
        );
        expect(add1Res.errors).toBeUndefined();
        expect(add1Res.data?.addInstituteToGroup).toBe(true);

        // add institute_2
        const add2Res = await gql<{ addInstituteToGroup: boolean }>(
          `mutation AddToGroup($instituteId: ID!, $groupId: ID!) {
            addInstituteToGroup(instituteId: $instituteId, groupId: $groupId)
          }`,
          { instituteId: SEED.INSTITUTE_2.id, groupId },
          instituteAdminToken,
        );
        expect(add2Res.errors).toBeUndefined();
        expect(add2Res.data?.addInstituteToGroup).toBe(true);

        // remove institute_1
        const removeRes = await gql<{ removeInstituteFromGroup: boolean }>(
          `mutation RemoveFromGroup($instituteId: ID!) {
            removeInstituteFromGroup(instituteId: $instituteId)
          }`,
          { instituteId: SEED.INSTITUTE_1.id },
          instituteAdminToken,
        );
        expect(removeRes.errors).toBeUndefined();
        expect(removeRes.data?.removeInstituteFromGroup).toBe(true);
      } finally {
        // Always unlink institute_2 and delete the group so the seed is left
        // clean for other tests (institutes belong to the shared tenant seed).
        await gql(
          `mutation RemoveFromGroup($instituteId: ID!) {
            removeInstituteFromGroup(instituteId: $instituteId)
          }`,
          { instituteId: SEED.INSTITUTE_2.id },
          instituteAdminToken,
        );
        await gql(
          `mutation AdminDelete($id: ID!) { adminDeleteInstituteGroup(id: $id) }`,
          { id: groupId },
          adminToken,
        );
      }
    });
  });

  // ─────────────────────────────────────────────────────
  // 04 — Not-found errors (@PlatformScope)
  // ─────────────────────────────────────────────────────
  describe('not-found errors', () => {
    it('adminDeleteInstituteGroup with zero-UUID returns errors', async () => {
      const res = await gql<{ adminDeleteInstituteGroup: boolean | null }>(
        `mutation AdminDelete($id: ID!) { adminDeleteInstituteGroup(id: $id) }`,
        { id: '00000000-0000-0000-0000-000000000000' },
        adminToken,
      );
      expect(res.errors).toBeDefined();
      expect(res.errors?.length ?? 0).toBeGreaterThanOrEqual(1);
    });
  });
});
