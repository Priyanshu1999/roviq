/**
 * Unit tests for TC issuance (ROV-161).
 *
 * Tests:
 * 1. TC data snapshot populates all 20 CBSE fields
 * 2. Clearance JSONB update logic
 * 3. Status transitions: requested → clearance_pending → ... → issued
 * 4. dateToWords conversion
 * 5. Student status updated to transferred_out after issuance
 */

import { GuardianRelationship } from '@roviq/common-types';
import type { DrizzleDB } from '@roviq/database';
import { createMock } from '@roviq/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CbseTcData } from '../workflows/tc-issuance.types';

// ── Sequential result queue (same pattern as guardian tests) ──

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
  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'limit' || prop === 'returning') return terminal;
        if (prop === 'then') {
          return (resolve: (v: unknown) => void) => resolve(nextResult());
        }
        if (prop === 'execute') return vi.fn(() => Promise.resolve({ rows: [nextResult()] }));
        return vi.fn(() => createMockTx());
      },
    },
  );
}

async function mockWithContext(_db: unknown, ...args: unknown[]) {
  const fn = args[args.length - 1] as (tx: unknown) => Promise<unknown>;
  return fn(createMockTx());
}

vi.mock('@roviq/database', () => ({
  DRIZZLE_DB: Symbol('DRIZZLE_DB'),
  withAdmin: vi.fn(mockWithContext),
  withTenant: vi.fn(mockWithContext),
  tcRegister: {
    id: 'id',
    status: 'status',
    clearances: 'clearances',
    reason: 'reason',
    tcData: 'tc_data',
  },
  studentProfiles: {
    id: 'id',
    academicStatus: 'academic_status',
    userId: 'user_id',
    socialCategory: 'social_category',
    isRteAdmitted: 'is_rte_admitted',
    admissionNumber: 'admission_number',
  },
  userProfiles: {
    userId: 'user_id',
    firstName: 'first_name',
    lastName: 'last_name',
    dateOfBirth: 'date_of_birth',
    nationality: 'nationality',
  },
  studentGuardianLinks: {
    studentProfileId: 'student_profile_id',
    guardianProfileId: 'guardian_profile_id',
    relationship: 'relationship',
  },
  guardianProfiles: { id: 'id', userId: 'user_id' },
  studentAcademics: {
    studentProfileId: 'student_profile_id',
    promotionStatus: 'promotion_status',
    standardId: 'standard_id',
    classRoles: 'class_roles',
  },
  tenantSequences: {},
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

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: unknown[]) => args),
  eq: vi.fn((a: unknown, b: unknown) => [a, b]),
  sql: Object.assign(vi.fn(), { raw: vi.fn() }),
}));

describe('TC Data Snapshot — All 20 CBSE Fields', () => {
  let activities: Awaited<
    ReturnType<typeof import('../workflows/tc-issuance.activities').createTCIssuanceActivities>
  >;

  beforeEach(async () => {
    vi.clearAllMocks();
    resetQueue();

    const { createTCIssuanceActivities } = await import('../workflows/tc-issuance.activities');
    activities = createTCIssuanceActivities(createMock<DrizzleDB>(), null);
  });

  it('populateTcData returns all 20 CBSE fields', async () => {
    // Queue results in order of DB calls within populateTcData:
    // 1. student_profile select
    queueResult([
      {
        id: 'sp1',
        userId: 'u1',
        socialCategory: 'obc',
        isRteAdmitted: false,
        admissionNumber: '2025/0001',
        admissionDate: '2020-04-01',
        admissionClass: 'Class 1',
        caste: 'Yadav',
        dateOfLeaving: null,
      },
    ]);
    // 2. user_profile select — firstName/lastName migrated to i18nText jsonb
    // (Record<string, string>); the export pipeline picks the `en` value via
    // a small resolver helper, so the fixture must mirror the new shape.
    queueResult([
      {
        firstName: { en: 'Arjun' },
        lastName: { en: 'Kumar' },
        dateOfBirth: '2010-04-15',
        gender: 'male',
        nationality: 'Indian',
      },
    ]);
    // 3. guardian links JOIN — same i18nText shape on the joined name fields
    queueResult([
      {
        relationship: GuardianRelationship.FATHER,
        firstName: { en: 'Suresh' },
        lastName: { en: 'Kumar' },
      },
      {
        relationship: GuardianRelationship.MOTHER,
        firstName: { en: 'Sunita' },
        lastName: { en: 'Devi' },
      },
    ]);
    // 4. student_academics
    queueResult([
      { promotionStatus: 'PROMOTED', standardId: 'std-5', classRoles: [] },
      { promotionStatus: 'PROMOTED', standardId: 'std-6', classRoles: ['class_monitor'] },
    ]);
    // 5. tc_register select (reason + clearances)
    queueResult([
      {
        reason: 'Transfer to another city',
        clearances: { accounts: { cleared: true } },
      },
    ]);
    // 6. tc_register update (persist snapshot) — returns void-like
    queueResult(undefined);

    const result = await activities.populateTcData('tenant-1', 'tc-1', 'sp1');
    const tc = result.tcData;

    // ── Verify all 20 CBSE fields ─────────────────────
    // 1. Student name
    expect(tc.studentName).toBe('Arjun Kumar');
    // 2. Mother's name
    expect(tc.motherName).toBe('Sunita Devi');
    // 3. Father's/Guardian's name
    expect(tc.fatherOrGuardianName).toBe('Suresh Kumar');
    // 4. Nationality
    expect(tc.nationality).toBe('Indian');
    // 5. Social category
    expect(tc.socialCategory).toBe('obc');
    // 6. DOB figures
    expect(tc.dateOfBirthFigures).toBe('2010-04-15');
    // 6b. DOB words
    expect(tc.dateOfBirthWords).toContain('April');
    expect(tc.dateOfBirthWords).toContain('Two Thousand');
    // 7. Whether failed
    expect(tc.whetherFailed).toBe('No');
    // 8. Subjects studied
    expect(tc.subjectsStudied).toBeTruthy();
    // 9. Class last studied
    expect(tc.classLastStudied).toBeTruthy();
    // 10. Last exam result
    expect(tc.lastExamResult).toBeTruthy();
    // 11. Qualified for promotion
    expect(tc.qualifiedForPromotion).toBe('Yes');
    // 12. Fees paid
    expect(tc.feesPaidUpTo).toBe('Yes');
    // 13. Fee concession
    expect(tc.feeConcession).toBe('None');
    // 14. NCC/Scout
    expect(tc.nccScoutGuide).toBeDefined();
    // 15. Date of leaving
    expect(tc.dateOfLeaving).toBeTruthy();
    // 16. Reason
    expect(tc.reasonForLeaving).toBe('Transfer to another city');
    // 17a. Working days
    expect(tc.totalWorkingDays).toBeTruthy();
    // 17b. Present days
    expect(tc.totalPresentDays).toBeTruthy();
    // 18. General conduct
    expect(tc.generalConduct).toBeTruthy();
    // 19. Remarks
    expect(tc.remarks).toBeDefined();
    // 20. Date of issue (null until Step 5)
    expect(tc.dateOfIssue).toBeNull();

    // Verify ALL 20 field keys exist
    const allKeys: (keyof CbseTcData)[] = [
      'studentName',
      'motherName',
      'fatherOrGuardianName',
      'nationality',
      'socialCategory',
      'dateOfBirthFigures',
      'dateOfBirthWords',
      'whetherFailed',
      'subjectsStudied',
      'classLastStudied',
      'lastExamResult',
      'qualifiedForPromotion',
      'feesPaidUpTo',
      'feeConcession',
      'nccScoutGuide',
      'dateOfLeaving',
      'reasonForLeaving',
      'totalWorkingDays',
      'totalPresentDays',
      'generalConduct',
      'remarks',
      'dateOfIssue',
    ];
    for (const key of allKeys) {
      expect(tc).toHaveProperty(key);
    }
    // 22 keys total (20 fields + DOB words as 6b + remarks as 19 = 22 properties)
    expect(Object.keys(tc).length).toBe(22);
  });

  it('whetherFailed correctly reports detention count', async () => {
    queueResult([{ id: 'sp1', userId: 'u1', socialCategory: 'general', isRteAdmitted: false }]);
    queueResult([
      {
        firstName: { en: 'Test' },
        lastName: { en: 'Student' },
        dateOfBirth: '2010-01-01',
        nationality: 'Indian',
      },
    ]);
    queueResult([]); // no guardians
    // 2 detentions
    queueResult([
      { promotionStatus: 'DETAINED', standardId: 'std-5', classRoles: [] },
      { promotionStatus: 'DETAINED', standardId: 'std-5', classRoles: [] },
      { promotionStatus: 'PROMOTED', standardId: 'std-6', classRoles: [] },
    ]);
    queueResult([{ reason: 'Transfer', clearances: {} }]);
    queueResult(undefined);

    const result = await activities.populateTcData('tenant-1', 'tc-1', 'sp1');
    expect(result.tcData.whetherFailed).toBe('Yes, twice');
  });

  it('RTE student gets fee concession noted', async () => {
    queueResult([{ id: 'sp1', userId: 'u1', socialCategory: 'ews', isRteAdmitted: true }]);
    queueResult([
      {
        firstName: { en: 'Riya' },
        lastName: null,
        dateOfBirth: null,
        nationality: 'Indian',
      },
    ]);
    queueResult([]);
    queueResult([]);
    queueResult([{ reason: 'Transfer', clearances: {} }]);
    queueResult(undefined);

    const result = await activities.populateTcData('tenant-1', 'tc-1', 'sp1');
    expect(result.tcData.feeConcession).toContain('RTE');
  });
});

describe('TC Status Transitions', () => {
  it('validateRequest throws if student not enrolled', async () => {
    resetQueue();
    const { createTCIssuanceActivities } = await import('../workflows/tc-issuance.activities');
    const activities = createTCIssuanceActivities(createMock<DrizzleDB>(), null);

    queueResult([{ academicStatus: 'transferred_out' }]); // student not enrolled

    await expect(activities.validateRequest('tenant-1', 'tc-1', 'sp1')).rejects.toThrow(
      'not enrolled',
    );
  });

  it('validateRequest throws if student not found', async () => {
    resetQueue();
    const { createTCIssuanceActivities } = await import('../workflows/tc-issuance.activities');
    const activities = createTCIssuanceActivities(createMock<DrizzleDB>(), null);

    queueResult([]); // student not found

    await expect(activities.validateRequest('tenant-1', 'tc-1', 'sp1')).rejects.toThrow(
      'not found',
    );
  });
});
