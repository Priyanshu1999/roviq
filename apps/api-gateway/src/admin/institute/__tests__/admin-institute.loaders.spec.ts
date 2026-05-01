/**
 * AdminInstituteLoaders unit tests.
 *
 * Verifies that the request-scoped DataLoader bundle:
 *   - batches multiple `.load(id)` calls into a single `withAdmin` DB query
 *   - maps resolved names back to the correct request position
 *   - returns `null` for ids that have no matching row
 *
 * `withAdmin` is mocked to intercept and delegate the tx function to a
 * controlled query mock. The mock records call counts so we can assert that
 * N concurrent loads produce exactly 1 DB round-trip per DataLoader type.
 */
import { getTableName } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminInstituteLoaders } from '../admin-institute.loaders';

// ── withAdmin / Drizzle mock ──────────────────────────────────────────────────

let selectCallCount = 0;
let lastSelectTableName: string | null = null;

// Rows staged for the next `tx.select(...).from(table)…` call
let stagedRows: unknown[] = [];

vi.mock('@roviq/database', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@roviq/database')>();
  return {
    ...actual,
    withAdmin: vi.fn(
      async (_db: unknown, ctxOrFn: unknown, fnArg?: (tx: unknown) => Promise<unknown>) => {
        const fn =
          typeof ctxOrFn === 'function'
            ? (ctxOrFn as (tx: unknown) => Promise<unknown>)
            : (fnArg as (tx: unknown) => Promise<unknown>);
        const tx = {
          select: vi.fn((_cols: unknown) => ({
            from: (table: unknown) => {
              selectCallCount += 1;
              lastSelectTableName =
                typeof table === 'object' && table !== null ? getTableName(table as never) : null;
              // biome-ignore lint/suspicious/noExplicitAny: test-only mock
              const rows: any = stagedRows;
              return {
                where: () => Promise.resolve(rows),
              };
            },
          })),
        };
        return fn(tx);
      },
    ),
  };
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeLoaders() {
  // AdminInstituteLoaders takes (db: DrizzleDB) — pass an empty object since
  // `withAdmin` is fully mocked and never touches the real DB handle.
  return new AdminInstituteLoaders({} as never);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AdminInstituteLoaders', () => {
  beforeEach(() => {
    selectCallCount = 0;
    lastSelectTableName = null;
    stagedRows = [];
  });

  describe('resellerName DataLoader', () => {
    it('returns null when the reseller row is not found', async () => {
      stagedRows = [];
      const loaders = makeLoaders();

      const name = await loaders.resellerName.load('non-existent-id');

      expect(name).toBeNull();
    });

    it('maps name from matching reseller row', async () => {
      const RESELLER_ID = 'r1111111-1111-4111-r111-111111111111';
      stagedRows = [{ id: RESELLER_ID, name: 'Acme Partners' }];
      const loaders = makeLoaders();

      const name = await loaders.resellerName.load(RESELLER_ID);

      expect(name).toBe('Acme Partners');
    });

    it('batches multiple load() calls into exactly one DB query', async () => {
      const IDS = [
        'r1111111-1111-4111-r111-111111111111',
        'r2222222-2222-4222-r222-222222222222',
        'r3333333-3333-4333-r333-333333333333',
      ];
      stagedRows = IDS.map((id, i) => ({ id, name: `Reseller ${i + 1}` }));
      const loaders = makeLoaders();

      // Fire all 3 loads before DataLoader flushes
      const [n1, n2, n3] = await Promise.all(IDS.map((id) => loaders.resellerName.load(id)));

      expect(selectCallCount).toBe(1);
      expect(lastSelectTableName).toBe('resellers');
      expect(n1).toBe('Reseller 1');
      expect(n2).toBe('Reseller 2');
      expect(n3).toBe('Reseller 3');
    });

    it('returns null for ids absent from the batch result while resolving others', async () => {
      const PRESENT = 'r1111111-1111-4111-r111-111111111111';
      const ABSENT = 'r9999999-9999-4999-r999-999999999999';
      stagedRows = [{ id: PRESENT, name: 'Found Reseller' }];
      const loaders = makeLoaders();

      const [present, absent] = await Promise.all([
        loaders.resellerName.load(PRESENT),
        loaders.resellerName.load(ABSENT),
      ]);

      expect(present).toBe('Found Reseller');
      expect(absent).toBeNull();
    });
  });

  describe('groupName DataLoader', () => {
    it('returns null when the group row is not found', async () => {
      stagedRows = [];
      const loaders = makeLoaders();

      const name = await loaders.groupName.load('non-existent-group');

      expect(name).toBeNull();
    });

    it('extracts English key when name is a JSONB i18n object', async () => {
      const GROUP_ID = 'g1111111-1111-4111-g111-111111111111';
      stagedRows = [{ id: GROUP_ID, name: { en: 'Science Trust', hi: 'विज्ञान ट्रस्ट' } }];
      const loaders = makeLoaders();

      const name = await loaders.groupName.load(GROUP_ID);

      expect(name).toBe('Science Trust');
    });

    it('returns plain string directly when name is not a JSONB object', async () => {
      const GROUP_ID = 'g2222222-2222-4222-g222-222222222222';
      stagedRows = [{ id: GROUP_ID, name: 'Legacy Plain Name' }];
      const loaders = makeLoaders();

      const name = await loaders.groupName.load(GROUP_ID);

      expect(name).toBe('Legacy Plain Name');
    });

    it('returns null when name is null', async () => {
      const GROUP_ID = 'g3333333-3333-4333-g333-333333333333';
      stagedRows = [{ id: GROUP_ID, name: null }];
      const loaders = makeLoaders();

      const name = await loaders.groupName.load(GROUP_ID);

      expect(name).toBeNull();
    });

    it('batches multiple load() calls into exactly one DB query', async () => {
      const IDS = ['g1111111-1111-4111-g111-111111111111', 'g2222222-2222-4222-g222-222222222222'];
      stagedRows = IDS.map((id, i) => ({ id, name: { en: `Group ${i + 1}` } }));
      const loaders = makeLoaders();

      const [g1, g2] = await Promise.all(IDS.map((id) => loaders.groupName.load(id)));

      expect(selectCallCount).toBe(1);
      expect(lastSelectTableName).toBe('institute_groups');
      expect(g1).toBe('Group 1');
      expect(g2).toBe('Group 2');
    });

    it('deduplicates repeated ids in the batch', async () => {
      const GROUP_ID = 'g1111111-1111-4111-g111-111111111111';
      stagedRows = [{ id: GROUP_ID, name: 'Unique Group' }];
      const loaders = makeLoaders();

      // Two loads for the same id — DataLoader deduplicates by default
      const [a, b] = await Promise.all([
        loaders.groupName.load(GROUP_ID),
        loaders.groupName.load(GROUP_ID),
      ]);

      expect(selectCallCount).toBe(1);
      expect(a).toBe('Unique Group');
      expect(b).toBe('Unique Group');
    });
  });
});
