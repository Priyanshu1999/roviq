/**
 * ROV-170 — Unit tests for GroupService CRUD + rule-engine wiring.
 *
 * Pure unit: mocks `@roviq/database` (withTenant + tables), `@roviq/groups`
 * (rule interpreter), and the request context. No DB is touched. Verifies the
 * service correctly forwards rules to the interpreter and captures insert
 * payloads for dynamic groups.
 */
import { DomainGroupType, DynamicGroupStatus, GroupMembershipType } from '@roviq/common-types';
import type { DrizzleDB } from '@roviq/database';
import { createMock } from '@roviq/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventBusService } from '../../../common/event-bus.service';

const resultQueue: unknown[] = [];
let queueIndex = 0;

function queueResult(r: unknown) {
  resultQueue.push(r);
}
function resetQueue() {
  resultQueue.length = 0;
  queueIndex = 0;
}
function nextResult(): unknown {
  const r = resultQueue[queueIndex] ?? [];
  queueIndex++;
  return r;
}

interface CapturedInsert {
  table: string;
  values: Record<string, unknown> | Record<string, unknown>[] | null;
}
const capturedInserts: CapturedInsert[] = [];
let currentTable: string | null = null;

function createMockTx() {
  const terminal = vi.fn(() => Promise.resolve(nextResult()));
  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'insert') {
          return (table: { __tableName?: string }) => {
            currentTable = table.__tableName ?? 'unknown';
            return createMockTx();
          };
        }
        if (prop === 'values') {
          return (vals: Record<string, unknown>) => {
            capturedInserts.push({ table: currentTable ?? 'unknown', values: vals });
            return createMockTx();
          };
        }
        if (prop === 'limit' || prop === 'returning') return terminal;
        if (prop === 'then') {
          return (resolve: (v: unknown) => void) => resolve(nextResult());
        }
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
  withTenant: vi.fn(mockWithContext),
  groups: { __tableName: 'groups', id: 'id', name: 'name', deletedAt: 'deleted_at' },
  groupRules: { __tableName: 'groupRules', groupId: 'group_id' },
  groupChildren: { __tableName: 'groupChildren' },
  groupMembers: {
    __tableName: 'groupMembers',
    groupId: 'group_id',
    source: 'source',
    isExcluded: 'is_excluded',
    membershipId: 'membership_id',
  },
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
}));

vi.mock('@roviq/groups', () => ({
  extractDimensions: vi.fn((_rule: unknown) => ['academic_status']),
  groupRuleToDrizzleSql: vi.fn(() => ({ __sql: 'mocked' })),
}));

vi.mock('@roviq/request-context', () => ({
  getRequestContext: () => ({ tenantId: 'tenant-1', userId: 'user-1' }),
}));

import { extractDimensions } from '@roviq/groups';
// Import AFTER mocks.
import { GroupService } from '../group.service';

describe('GroupService (unit)', () => {
  let service: GroupService;
  let eventBus: EventBusService;

  beforeEach(() => {
    resetQueue();
    capturedInserts.length = 0;
    currentTable = null;
    vi.clearAllMocks();
    const db = createMock<DrizzleDB>();
    eventBus = createMock<EventBusService>({ emit: vi.fn() });
    service = new GroupService(db, eventBus);
  });

  it('create inserts a dynamic group and delegates rule dimensions to extractDimensions', async () => {
    const groupRow = {
      id: 'grp-1',
      name: 'Class 5 enrolled',
      groupType: 'custom',
      membershipType: 'dynamic',
      status: DynamicGroupStatus.ACTIVE,
    };
    // First .returning() call from groups insert.
    queueResult([groupRow]);

    const rule = { '==': [{ var: 'academic_status' }, 'enrolled'] };
    const result = await service.create({
      name: 'Class 5 enrolled',
      groupType: DomainGroupType.CUSTOM,
      membershipType: GroupMembershipType.DYNAMIC,
      memberTypes: ['student'],
      rule,
    });

    expect(result.id).toBe('grp-1');
    expect(extractDimensions).toHaveBeenCalledWith(rule);

    const groupInsert = capturedInserts.find((c) => c.table === 'groups');
    expect(groupInsert).toBeDefined();
    const values = groupInsert?.values as Record<string, unknown>;
    expect(values.name).toBe('Class 5 enrolled');
    expect(values.tenantId).toBe('tenant-1');
    expect(values.membershipType).toBe(GroupMembershipType.DYNAMIC);
    expect(values.createdBy).toBe('user-1');

    const ruleInsert = capturedInserts.find((c) => c.table === 'groupRules');
    expect(ruleInsert).toBeDefined();
    const ruleValues = ruleInsert?.values as Record<string, unknown>;
    expect(ruleValues.rule).toEqual(rule);
    expect(ruleValues.ruleDimensions).toEqual(['academic_status']);
  });

  it('create without a rule skips the groupRules insert entirely', async () => {
    queueResult([{ id: 'grp-2', name: 'Static club', groupType: DomainGroupType.CLUB }]);

    await service.create({
      name: 'Static club',
      groupType: DomainGroupType.CLUB,
      membershipType: GroupMembershipType.STATIC,
    });

    expect(capturedInserts.find((c) => c.table === 'groupRules')).toBeUndefined();
    expect(extractDimensions).not.toHaveBeenCalled();
  });

  it('findById throws NotFoundException when no row is returned', async () => {
    queueResult([]);
    await expect(service.findById('missing')).rejects.toThrow(/not found/i);
  });
});
