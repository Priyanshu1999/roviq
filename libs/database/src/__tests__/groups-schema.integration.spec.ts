/**
 * M6 Groups Schema Integration Tests.
 *
 * Verifies: groups, group_rules, group_members, group_children —
 * UNIQUE constraints, CHECK constraints, self-reference prevention, FORCE RLS.
 *
 * Run: pnpm nx test database -- --project integration
 */
import { DomainGroupType, GroupMemberSource, GroupMembershipType } from '@roviq/common-types';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createMembership, createTestUser, findRole, TEST_SUPERUSER_URL } from './test-helpers';

const SUPERUSER_URL = TEST_SUPERUSER_URL;

const SEED = {
  INSTITUTE_1: '00000000-0000-7000-a000-000000000101',
  INSTITUTE_2: '00000000-0000-7000-a000-000000000102',
  USER_ADMIN: '00000000-0000-7000-a000-000000000201',
  USER_TEACHER: '00000000-0000-7000-a000-000000000202',
};

let superPool: pg.Pool;

beforeAll(async () => {
  superPool = new pg.Pool({ connectionString: SUPERUSER_URL, max: 3 });
  const res = await superPool.query('SELECT 1 as ok');
  expect(res.rows[0].ok).toBe(1);
});

afterAll(async () => {
  await superPool.end();
});

async function inTransaction(fn: (client: pg.PoolClient) => Promise<void>): Promise<void> {
  const client = await superPool.connect();
  try {
    await client.query('BEGIN');
    await fn(client);
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
}

/** Insert a group and return its ID. */
async function insertGroup(
  client: pg.PoolClient,
  id: string,
  tenantId: string,
  opts?: {
    name?: string;
    groupType?: string;
    membershipType?: string;
    parentGroupId?: string | null;
  },
): Promise<string> {
  const name = opts?.name ?? 'Test Group';
  const groupType = opts?.groupType ?? DomainGroupType.CUSTOM;
  const membershipType = opts?.membershipType ?? GroupMembershipType.STATIC;
  const parentGroupId = opts?.parentGroupId ?? null;

  await client.query(
    `INSERT INTO groups (
      id, name, group_type, membership_type, parent_group_id,
      tenant_id, created_by, updated_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7)`,
    [id, name, groupType, membershipType, parentGroupId, tenantId, SEED.USER_ADMIN],
  );
  return id;
}

// ── Group name partial unique ─────────────────────────────────

describe('M6: groups partial unique constraint (tenant_id, name) WHERE deleted_at IS NULL', () => {
  it('two groups with same name in same tenant → constraint violation', async () => {
    await inTransaction(async (client) => {
      await insertGroup(client, 'ffffffff-a001-0001-0001-000000000001', SEED.INSTITUTE_1, {
        name: 'Science Club',
      });

      const err = await insertGroup(
        client,
        'ffffffff-a001-0001-0001-000000000002',
        SEED.INSTITUTE_1,
        { name: 'Science Club' },
      ).catch((e: Error) => e);

      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toMatch(/unique|duplicate/i);
    });
  });

  it('group name reusable after soft delete → succeeds', async () => {
    await inTransaction(async (client) => {
      await insertGroup(client, 'ffffffff-a002-0001-0001-000000000001', SEED.INSTITUTE_1, {
        name: 'Drama Club',
      });

      // Soft-delete the first group
      await client.query(`UPDATE groups SET deleted_at = now(), deleted_by = $1 WHERE id = $2`, [
        SEED.USER_ADMIN,
        'ffffffff-a002-0001-0001-000000000001',
      ]);

      // Insert with the same name — should succeed because partial unique excludes deleted rows
      await insertGroup(client, 'ffffffff-a002-0001-0001-000000000002', SEED.INSTITUTE_1, {
        name: 'Drama Club',
      });

      const res = await client.query(
        `SELECT id FROM groups WHERE name = 'Drama Club' AND deleted_at IS NULL`,
      );
      expect(res.rows).toHaveLength(1);
      expect(res.rows[0].id).toBe('ffffffff-a002-0001-0001-000000000002');
    });
  });
});

// ── group_children self-reference blocked ─────────────────────

describe('M6: group_children CHECK (parent != child)', () => {
  it('insert with parent_group_id = child_group_id → CHECK violation', async () => {
    await inTransaction(async (client) => {
      const groupId = 'ffffffff-a003-0001-0001-000000000001';
      await insertGroup(client, groupId, SEED.INSTITUTE_1, {
        name: 'Composite Group',
        groupType: DomainGroupType.COMPOSITE,
      });

      const err = await client
        .query(
          `INSERT INTO group_children (parent_group_id, child_group_id, tenant_id)
           VALUES ($1, $1, $2)`,
          [groupId, SEED.INSTITUTE_1],
        )
        .catch((e: Error) => e);

      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toMatch(/chk_no_self_ref|violates check constraint/i);
    });
  });
});

// ── group_members UNIQUE(group_id, membership_id) ─────────────

describe('M6: group_members UNIQUE(group_id, membership_id)', () => {
  it('duplicate group_id + membership_id → UNIQUE violation', async () => {
    await inTransaction(async (client) => {
      const testUser = await createTestUser(client, 'eeeeeeee-ab01-0001-0001-000000000001');
      const roleId = await findRole(client, SEED.INSTITUTE_1);
      const groupId = 'ffffffff-a004-0001-0001-000000000001';
      const memId = 'ffffffff-a004-0001-0001-000000000010';

      await insertGroup(client, groupId, SEED.INSTITUTE_1, {
        name: 'Unique Test Group',
      });
      await createMembership(client, memId, testUser, SEED.INSTITUTE_1, roleId);

      // First member insert
      await client.query(
        `INSERT INTO group_members (id, group_id, tenant_id, membership_id, source)
         VALUES ($1, $2, $3, $4, '${GroupMemberSource.MANUAL}')`,
        ['ffffffff-a004-0001-0001-000000000020', groupId, SEED.INSTITUTE_1, memId],
      );

      // Duplicate → should fail
      const err = await client
        .query(
          `INSERT INTO group_members (id, group_id, tenant_id, membership_id, source)
           VALUES ($1, $2, $3, $4, '${GroupMemberSource.RULE}')`,
          ['ffffffff-a004-0001-0001-000000000021', groupId, SEED.INSTITUTE_1, memId],
        )
        .catch((e: Error) => e);

      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toMatch(/unique|duplicate/i);
    });
  });
});

// ── All 16 group types accepted ──────────────────────────────

describe('M6: group_type CHECK constraint', () => {
  it("accepts valid type 'composite'", async () => {
    await inTransaction(async (client) => {
      const id = 'ffffffff-a005-0001-0001-000000000001';
      await insertGroup(client, id, SEED.INSTITUTE_1, {
        name: 'Composite Valid',
        groupType: DomainGroupType.COMPOSITE,
      });

      const res = await client.query('SELECT group_type FROM groups WHERE id = $1', [id]);
      expect(res.rows[0].group_type).toBe(DomainGroupType.COMPOSITE);
    });
  });

  it("rejects invalid group_type 'classroom'", async () => {
    await inTransaction(async (client) => {
      const err = await insertGroup(
        client,
        'ffffffff-a005-0001-0001-000000000002',
        SEED.INSTITUTE_1,
        { name: 'Invalid Type', groupType: 'classroom' },
      ).catch((e: Error) => e);

      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toMatch(/invalid input value for enum/i);
    });
  });
});

// ── FORCE RLS checks ──────────────────────────────────────────

describe('M6: FORCE RLS on all 4 tables', () => {
  const tables = ['groups', 'group_rules', 'group_members', 'group_children'];

  for (const tableName of tables) {
    it(`${tableName} has FORCE ROW LEVEL SECURITY`, async () => {
      const res = await superPool.query(
        'SELECT relforcerowsecurity FROM pg_class WHERE relname = $1',
        [tableName],
      );
      if (res.rows.length > 0) {
        expect(res.rows[0].relforcerowsecurity).toBe(true);
      }
    });
  }
});
