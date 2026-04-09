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
  cnt: number;
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
      } = Object.assign(Promise.resolve(batch), {
        from: vi.fn(() => promise),
        groupBy: vi.fn(() => promise),
        where: vi.fn(() => promise),
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
        _tenantId: string,
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
    const db = createMock<object>();
    const eventBus = createMock<EventBusService>();
    const config = createMock<ConfigService>({
      get: vi.fn(),
    });
    return new AdmissionService(
      db as unknown as ConstructorParameters<typeof AdmissionService>[0],
      eventBus,
      config,
    );
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
          { status: 'submitted', cnt: 40 },
          { status: 'documents_verified', cnt: 20 },
          { status: 'enrolled', cnt: 15 },
          { status: 'rejected', cnt: 5 },
        ],
        [
          { source: 'walk_in', cnt: 60 },
          { source: 'referral', cnt: 40 },
        ],
      ]),
    );
    const service = makeService();

    const stats = await withTestContext(() => service.statistics());

    expect(stats.totalEnquiries).toBe(100);
    expect(stats.totalApplications).toBe(60);
    const byStage = new Map(stats.funnel.map((f) => [f.stage, f.count]));
    expect(byStage.get('submitted')).toBe(40);
    expect(byStage.get('documents_verified')).toBe(20);
    expect(byStage.get('enrolled')).toBe(15);
    // Stages with no data default to 0, not undefined.
    expect(byStage.get('fee_paid')).toBe(0);
    // `rejected` is terminal and NOT part of FUNNEL_STAGES.
    expect(byStage.has('rejected')).toBe(false);

    expect(stats.bySource).toHaveLength(2);
    const srcMap = new Map(stats.bySource.map((s) => [s.source, s.enquiryCount]));
    expect(srcMap.get('walk_in')).toBe(60);
    expect(srcMap.get('referral')).toBe(40);
  });

  it('computes conversion rates: enquiries → applications and applications → enrolled', async () => {
    setNextTx(
      buildMockTx([
        [{ totalEnq: 200 }],
        [{ totalApp: 50 }],
        [
          { status: 'submitted', cnt: 30 },
          { status: 'enrolled', cnt: 20 },
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
});
