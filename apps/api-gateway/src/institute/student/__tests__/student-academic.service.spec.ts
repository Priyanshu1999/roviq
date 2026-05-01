/**
 * ROV-167 — Unit tests for StudentAcademicService (no DB).
 *
 * Focuses on the capacity-check branch of `enroll` / `changeSection`, which
 * is pure logic once `getSectionWithNorms` is mocked. We bypass NestJS DI by
 * instantiating the service via `Object.create(prototype)` and wiring deps
 * directly — mirroring the pattern in `staff-qualification.spec.ts`.
 */

import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Sequential result queue ───────────────────────────────────

const resultQueue: unknown[] = [];
let queueIndex = 0;

function queueResult(result: unknown) {
  resultQueue.push(result);
}

function resetQueue() {
  resultQueue.length = 0;
  queueIndex = 0;
}

function nextResult(): unknown {
  const result = resultQueue[queueIndex] ?? [];
  queueIndex++;
  return result;
}

function createMockTx() {
  const terminal = vi.fn(() => Promise.resolve(nextResult()));
  const chain: unknown = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'limit' || prop === 'returning') return terminal;
        if (prop === 'then') {
          return (resolve: (v: unknown) => void) => resolve(nextResult());
        }
        return vi.fn(() => chain);
      },
    },
  );
  return chain;
}

async function mockWithContext(_db: unknown, ...args: unknown[]) {
  const fn = args[args.length - 1] as (tx: unknown) => Promise<unknown>;
  return fn(createMockTx());
}

const col = new Proxy(
  {},
  {
    get: () => 'col',
  },
);

vi.mock('@roviq/database', () => ({
  DRIZZLE_DB: Symbol('DRIZZLE_DB'),
  withTenant: vi.fn(mockWithContext),
  withAdmin: vi.fn(mockWithContext),
  academicYears: col,
  instituteConfigs: col,
  sections: col,
  standards: col,
  studentAcademics: col,
  academicYearsLive: { __tableName: 'academicYearsLive' },
  admissionApplicationsLive: { __tableName: 'admissionApplicationsLive' },
  attendanceEntriesLive: { __tableName: 'attendanceEntriesLive' },
  attendanceSessionsLive: { __tableName: 'attendanceSessionsLive' },
  botProfilesLive: { __tableName: 'botProfilesLive' },
  enquiriesLive: { __tableName: 'enquiriesLive' },
  groupsLive: { __tableName: 'groupsLive' },
  guardianProfilesLive: { __tableName: 'guardianProfilesLive' },
  holidaysLive: { __tableName: 'holidaysLive' },
  instituteAffiliationsLive: { __tableName: 'instituteAffiliationsLive' },
  instituteBrandingLive: { __tableName: 'instituteBrandingLive' },
  instituteConfigsLive: { __tableName: 'instituteConfigsLive' },
  instituteGroupBrandingLive: { __tableName: 'instituteGroupBrandingLive' },
  instituteIdentifiersLive: { __tableName: 'instituteIdentifiersLive' },
  institutesLive: { __tableName: 'institutesLive' },
  issuedCertificatesLive: { __tableName: 'issuedCertificatesLive' },
  leavesLive: { __tableName: 'leavesLive' },
  membershipsLive: { __tableName: 'membershipsLive' },
  rolesLive: { __tableName: 'rolesLive' },
  sectionSubjectsLive: { __tableName: 'sectionSubjectsLive' },
  sectionsLive: { __tableName: 'sectionsLive' },
  staffProfilesLive: { __tableName: 'staffProfilesLive' },
  standardSubjectsLive: { __tableName: 'standardSubjectsLive' },
  standardsLive: { __tableName: 'standardsLive' },
  studentAcademicsLive: { __tableName: 'studentAcademicsLive' },
  studentProfilesLive: { __tableName: 'studentProfilesLive' },
  subjectsLive: { __tableName: 'subjectsLive' },
  tcRegisterLive: { __tableName: 'tcRegisterLive' },
  mkInstituteCtx: (tenantId: string) => ({
    _scope: 'institute',
    scope: 'institute',
    tenantId,
    userId: 'u',
    membershipId: 'm',
    roleId: 'r',
    type: 'access',
  }),
  mkResellerCtx: (resellerId: string) => ({
    _scope: 'reseller',
    scope: 'reseller',
    resellerId,
    userId: 'u',
    membershipId: 'm',
    roleId: 'r',
    type: 'access',
  }),
  mkAdminCtx: () => ({
    _scope: 'platform',
    scope: 'platform',
    userId: 'u',
    membershipId: 'm',
    roleId: 'r',
    type: 'access',
  }),
}));

vi.mock('@roviq/request-context', () => ({
  getRequestContext: vi.fn(() => ({
    tenantId: 'tenant-1',
    userId: 'user-1',
    correlationId: 'test',
  })),
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: unknown[]) => args),
  eq: vi.fn((a: unknown, b: unknown) => [a, b]),
  desc: vi.fn((col: unknown) => col),
  isNull: vi.fn((a: unknown) => ['isNull', a]),
  sql: Object.assign(
    vi.fn(() => 'sql'),
    { raw: vi.fn(() => 'raw') },
  ),
}));

interface MockEventBus {
  emit: ReturnType<typeof vi.fn>;
}

async function createService(eventBus: MockEventBus) {
  const mod = await import('../student-academic.service');
  const svc = Object.create(mod.StudentAcademicService.prototype);
  svc.db = {};
  svc.eventBus = eventBus;
  svc.logger = { log: vi.fn(), warn: vi.fn(), error: vi.fn() };
  return svc as InstanceType<typeof mod.StudentAcademicService>;
}

describe('StudentAcademicService (unit)', () => {
  let service: Awaited<ReturnType<typeof createService>>;
  let eventBus: MockEventBus;

  beforeEach(async () => {
    vi.clearAllMocks();
    resetQueue();
    eventBus = { emit: vi.fn() };
    service = await createService(eventBus);
  });

  describe('enroll', () => {
    it('throws SECTION_CAPACITY_EXCEEDED when section is at hardMax and no overrideReason', async () => {
      // getSectionWithNorms → section SELECT returns a section at hardMax (45/45).
      queueResult([{ currentStrength: 45, capacity: 45 }]);
      // getSectionWithNorms → config SELECT returns default norms.
      queueResult([{ sectionStrengthNorms: { optimal: 40, hardMax: 45, exemptionAllowed: true } }]);

      await expect(
        service.enroll({
          studentProfileId: 'student-1',
          academicYearId: 'ay-1',
          standardId: 'std-1',
          sectionId: 'sec-1',
        }),
      ).rejects.toMatchObject({
        response: { code: 'SECTION_CAPACITY_EXCEEDED' },
      });
    });

    it('throws UnprocessableEntityException for capacity overflow', async () => {
      queueResult([{ currentStrength: 50, capacity: 45 }]);
      queueResult([{ sectionStrengthNorms: { optimal: 40, hardMax: 45, exemptionAllowed: true } }]);

      await expect(
        service.enroll({
          studentProfileId: 'student-1',
          academicYearId: 'ay-1',
          standardId: 'std-1',
          sectionId: 'sec-1',
        }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('succeeds past capacity when overrideReason is provided', async () => {
      // getSectionWithNorms: section at cap.
      queueResult([{ currentStrength: 45, capacity: 45 }]);
      queueResult([{ sectionStrengthNorms: { optimal: 40, hardMax: 45, exemptionAllowed: true } }]);
      // Insert .returning() → the inserted row.
      queueResult([{ id: 'sa-1' }]);
      // Update section.currentStrength → no returning, resolves [].

      const result = await service.enroll({
        studentProfileId: 'student-1',
        academicYearId: 'ay-1',
        standardId: 'std-1',
        sectionId: 'sec-1',
        overrideReason: 'RTE admission requires seat',
      });

      expect(result).toEqual({ id: 'sa-1' });
      // Capacity warning because currentStrength+1 (46) >= optimal (40).
      expect(eventBus.emit).toHaveBeenCalledWith(
        'SECTION.capacity_warning',
        expect.objectContaining({ sectionId: 'sec-1' }),
      );
      expect(eventBus.emit).toHaveBeenCalledWith(
        'STUDENT.enrolled',
        expect.objectContaining({ studentProfileId: 'student-1' }),
      );
    });
  });

  describe('changeSection', () => {
    it('throws SECTION_CAPACITY_EXCEEDED when the target section is full', async () => {
      // Current enrollment SELECT.
      queueResult([{ id: 'sa-1', sectionId: 'sec-old', studentProfileId: 'student-1' }]);
      // getSectionWithNorms on the NEW section: at hardMax, no override.
      queueResult([{ currentStrength: 45, capacity: 45 }]);
      queueResult([{ sectionStrengthNorms: { optimal: 40, hardMax: 45, exemptionAllowed: true } }]);

      await expect(
        service.changeSection({
          studentAcademicId: 'sa-1',
          newSectionId: 'sec-new',
        }),
      ).rejects.toMatchObject({
        response: { code: 'SECTION_CAPACITY_EXCEEDED' },
      });
    });

    it('throws NotFoundException when the enrollment does not exist', async () => {
      queueResult([]); // current enrollment SELECT → empty.

      await expect(
        service.changeSection({
          studentAcademicId: 'missing',
          newSectionId: 'sec-new',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
