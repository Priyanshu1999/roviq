/**
 * ROV-168 — Unit tests for AdmissionService.statistics() (admission funnel).
 *
 * Pure logic: verify funnel aggregation + conversion rate math without touching
 * the database. `@roviq/database` is mocked so `withTenant` runs its callback
 * against an in-memory fluent-chain stub that returns queued row batches for
 * the four SELECTs the service makes:
 *   1) count(*) from enquiries
 *   2) count(*) from admission_applications
 *   3) status breakdown from admission_applications
 *   4) source breakdown from enquiries
 */

import type { ConfigService } from '@nestjs/config';
import { AdmissionApplicationStatus } from '@roviq/common-types';
import { withTestContext } from '@roviq/request-context';
import { createMock } from '@roviq/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EventBusService } from '../../../common/event-bus.service';

interface TotalEnquiryRow {
  totalEnq: number;
}
interface TotalApplicationRow {
  totalApp: number;
}
interface StatusBreakdownRow {
  status: string;
  cnt: number;
}
interface SourceBreakdownRow {
  source: string;
  enquiryCount: number;
  applicationCount: number;
}

type QueryBatch =
  | TotalEnquiryRow[]
  | TotalApplicationRow[]
  | StatusBreakdownRow[]
  | SourceBreakdownRow[];

/**
 * Build a single-use mock transaction whose fluent chain resolves the four
 * SELECTs queued in order. Each `select()` call pops the next batch.
 */
function buildMockTx(batches: QueryBatch[]) {
  const queue = [...batches];
  const handle = {
    select: vi.fn(() => {
      const batch = queue.shift() ?? [];
      const promise: Promise<QueryBatch> & {
        from: (..._args: unknown[]) => typeof promise;
        groupBy: (..._args: unknown[]) => typeof promise;
        where: (..._args: unknown[]) => typeof promise;
        leftJoin: (..._args: unknown[]) => typeof promise;
        innerJoin: (..._args: unknown[]) => typeof promise;
      } = Object.assign(Promise.resolve(batch), {
        from: vi.fn(() => promise),
        groupBy: vi.fn(() => promise),
        where: vi.fn(() => promise),
        leftJoin: vi.fn(() => promise),
        innerJoin: vi.fn(() => promise),
      });
      return promise;
    }),
  };
  return handle;
}

vi.mock('@roviq/database', async () => {
  const actual = await vi.importActual<typeof import('@roviq/database')>('@roviq/database');
  return {
    ...actual,
    withTenant: vi.fn(
      async (
        _db: unknown,
        _ctxOrTenantId: unknown,
        fn: (tx: ReturnType<typeof buildMockTx>) => Promise<unknown>,
      ) => {
        // The default tx is injected per-test via `setNextTx` below.
        const tx = nextTx;
        if (!tx) throw new Error('admission-statistics test: no mock tx queued');
        return fn(tx);
      },
    ),
  };
});

let nextTx: ReturnType<typeof buildMockTx> | undefined;
function setNextTx(tx: ReturnType<typeof buildMockTx>): void {
  nextTx = tx;
}

describe('AdmissionService.statistics() (unit)', () => {
  // Use dynamic import so the `vi.mock('@roviq/database', …)` call above is
  // hoisted before the service file pulls in `@roviq/database`.
  let AdmissionService: typeof import('../admission.service').AdmissionService;

  beforeEach(async () => {
    nextTx = undefined;
    ({ AdmissionService } = await import('../admission.service'));
  });

  function makeService() {
    // Drop the `as unknown as` cast banned by [NTESC]: ask `createMock` for
    // the exact constructor parameter shape directly so the mock is typed
    // correctly without escaping the type system.
    type DbDep = ConstructorParameters<typeof AdmissionService>[0];
    const db = createMock<DbDep>();
    const eventBus = createMock<EventBusService>();
    const config = createMock<ConfigService>({
      get: vi.fn(),
    });
    return new AdmissionService(db, eventBus, config);
  }

  it('returns zero counts and zero conversion rates when there are no rows', async () => {
    setNextTx(
      buildMockTx([
        [{ totalEnq: 0 }],
        [{ totalApp: 0 }],
        [], // no application status rows
        [], // no enquiry source rows
      ]),
    );
    const service = makeService();

    const stats = await withTestContext(() => service.statistics());

    expect(stats.totalEnquiries).toBe(0);
    expect(stats.totalApplications).toBe(0);
    expect(stats.enquiryToApplicationRate).toBe(0);
    expect(stats.applicationToEnrolledRate).toBe(0);
    // Funnel still returns all stages with count 0.
    expect(stats.funnel.length).toBeGreaterThan(0);
    for (const entry of stats.funnel) {
      expect(entry.count).toBe(0);
    }
    expect(stats.bySource).toEqual([]);
  });

  it('returns correct funnel counts and source breakdown with mocked rows', async () => {
    setNextTx(
      buildMockTx([
        [{ totalEnq: 100 }],
        [{ totalApp: 60 }],
        [
          { status: AdmissionApplicationStatus.SUBMITTED, cnt: 40 },
          { status: AdmissionApplicationStatus.DOCUMENTS_VERIFIED, cnt: 20 },
          { status: AdmissionApplicationStatus.ENROLLED, cnt: 15 },
          { status: AdmissionApplicationStatus.REJECTED, cnt: 5 },
        ],
        [
          { source: 'walk_in', enquiryCount: 60, applicationCount: 30 },
          { source: 'referral', enquiryCount: 40, applicationCount: 18 },
        ],
      ]),
    );
    const service = makeService();

    const stats = await withTestContext(() => service.statistics());

    expect(stats.totalEnquiries).toBe(100);
    expect(stats.totalApplications).toBe(60);
    const byStage = new Map(stats.funnel.map((f) => [f.stage, f.count]));
    expect(byStage.get(AdmissionApplicationStatus.SUBMITTED)).toBe(40);
    expect(byStage.get(AdmissionApplicationStatus.DOCUMENTS_VERIFIED)).toBe(20);
    expect(byStage.get(AdmissionApplicationStatus.ENROLLED)).toBe(15);
    // Stages with no data default to 0, not undefined.
    expect(byStage.get(AdmissionApplicationStatus.FEE_PAID)).toBe(0);
    // `rejected` is terminal and NOT part of FUNNEL_STAGES.
    expect(byStage.has(AdmissionApplicationStatus.REJECTED)).toBe(false);

    expect(stats.bySource).toHaveLength(2);
    const srcMap = new Map(stats.bySource.map((s) => [s.source, s]));
    expect(srcMap.get('walk_in')?.enquiryCount).toBe(60);
    expect(srcMap.get('walk_in')?.applicationCount).toBe(30);
    expect(srcMap.get('referral')?.enquiryCount).toBe(40);
    expect(srcMap.get('referral')?.applicationCount).toBe(18);
  });

  it('computes conversion rates: enquiries → applications and applications → enrolled', async () => {
    setNextTx(
      buildMockTx([
        [{ totalEnq: 200 }],
        [{ totalApp: 50 }],
        [
          { status: AdmissionApplicationStatus.SUBMITTED, cnt: 30 },
          { status: AdmissionApplicationStatus.ENROLLED, cnt: 20 },
        ],
        [],
      ]),
    );
    const service = makeService();

    const stats = await withTestContext(() => service.statistics());

    // 50 / 200 = 0.25
    expect(stats.enquiryToApplicationRate).toBeCloseTo(0.25, 5);
    // 20 / 50 = 0.4
    expect(stats.applicationToEnrolledRate).toBeCloseTo(0.4, 5);
  });

  it('passes the date-range filter through to all aggregate queries', async () => {
    // Each select on the mock tx triggers a `where()` call. We capture every
    // `where` invocation on the chained query handle so the test can assert
    // the IST-anchored SQL fragments are wired into all four aggregates.
    const whereSpy = vi.fn();

    const tx = {
      select: vi.fn(() => {
        const promise: Promise<unknown[]> & {
          from: (..._a: unknown[]) => typeof promise;
          groupBy: (..._a: unknown[]) => typeof promise;
          where: (..._a: unknown[]) => typeof promise;
          leftJoin: (..._a: unknown[]) => typeof promise;
        } = Object.assign(Promise.resolve([{ totalEnq: 0, totalApp: 0 }]), {
          from: vi.fn(() => promise),
          groupBy: vi.fn(() => promise),
          where: vi.fn((...args: unknown[]) => {
            whereSpy(...args);
            return promise;
          }),
          leftJoin: vi.fn(() => promise),
        });
        return promise;
      }),
    };
    setNextTx(tx);
    const service = makeService();

    await withTestContext(() => service.statistics({ from: '2026-04-01', to: '2026-04-30' }));

    // Every aggregate (totalEnq, totalApp, status counts, source breakdown)
    // is filtered — i.e. `.where(...)` is called once per select with a
    // non-undefined predicate. That's 4 selects under filter.
    expect(whereSpy).toHaveBeenCalledTimes(4);
    for (const call of whereSpy.mock.calls) {
      // The Drizzle `and(...)` predicate is the first argument; assert it's
      // present (not undefined) — a regression that drops the filter from
      // any one aggregate would leave at least one call with `undefined`.
      expect(call[0]).toBeDefined();
    }
  });

  it('omits the where clause when no filter is supplied', async () => {
    const whereSpy = vi.fn();
    const tx = {
      select: vi.fn(() => {
        const promise: Promise<unknown[]> & {
          from: (..._a: unknown[]) => typeof promise;
          groupBy: (..._a: unknown[]) => typeof promise;
          where: (..._a: unknown[]) => typeof promise;
          leftJoin: (..._a: unknown[]) => typeof promise;
        } = Object.assign(Promise.resolve([{ totalEnq: 0, totalApp: 0 }]), {
          from: vi.fn(() => promise),
          groupBy: vi.fn(() => promise),
          where: vi.fn((...args: unknown[]) => {
            whereSpy(...args);
            return promise;
          }),
          leftJoin: vi.fn(() => promise),
        });
        return promise;
      }),
    };
    setNextTx(tx);
    const service = makeService();

    await withTestContext(() => service.statistics());

    // With no filter every aggregate still calls `.where(undefined)` (so
    // Drizzle no-ops the predicate). Verify the predicate is undefined.
    for (const call of whereSpy.mock.calls) {
      expect(call[0]).toBeUndefined();
    }
  });
});
