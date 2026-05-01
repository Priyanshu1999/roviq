import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BusinessException, ErrorCode, ResellerStatus } from '@roviq/common-types';
import {
  academicYearsLive,
  DRIZZLE_DB,
  type DrizzleDB,
  instituteAffiliationsLive,
  instituteGroups,
  mkAdminCtx,
  resellers,
  sectionsLive,
  standardSubjectsLive,
  standardsLive,
  subjectsLive,
  withAdmin,
} from '@roviq/database';
import { getRequestContext } from '@roviq/request-context';
import { Client, Connection } from '@temporalio/client';
import { and, asc, desc, eq } from 'drizzle-orm';
import { EventBusService } from '../../common/event-bus.service';
import { encodeCursor } from '../../common/pagination/relay-pagination.model';
import { InstituteService } from '../../institute/management/institute.service';
import { InstituteRepository } from '../../institute/management/repositories/institute.repository';
import type { InstituteRecord } from '../../institute/management/repositories/types';
import type { AdminListInstitutesFilterInput } from './dto/admin-list-institutes-filter.input';
import type { AcademicTreeModel } from './models/academic-tree.model';

@Injectable()
export class AdminInstituteService {
  private readonly logger = new Logger(AdminInstituteService.name);

  constructor(
    private readonly instituteService: InstituteService,
    private readonly instituteRepo: InstituteRepository,
    private readonly eventBus: EventBusService,
    private readonly configService: ConfigService,
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDB,
  ) {}

  async list(filter: AdminListInstitutesFilterInput) {
    const limit = filter.first ?? 20;

    const { records, total } = await this.instituteRepo.search({
      search: filter.search,
      statuses: filter.status,
      type: filter.type,
      resellerId: filter.resellerId,
      groupId: filter.groupId,
      createdAfter: filter.createdAfter,
      createdBefore: filter.createdBefore,
      first: limit + 1, // Fetch one extra to determine hasNextPage
      after: filter.after,
    });

    const hasNextPage = records.length > limit;
    const nodes = hasNextPage ? records.slice(0, limit) : records;

    const edges = nodes.map((record) => ({
      node: record,
      cursor: encodeCursor({ id: record.id }),
    }));

    return {
      edges,
      pageInfo: {
        hasNextPage,
        hasPreviousPage: !!filter.after,
        startCursor: edges[0]?.cursor,
        endCursor: edges[edges.length - 1]?.cursor,
      },
      totalCount: total,
    };
  }

  async approve(id: string) {
    const institute = await this.instituteService.findById(id);
    if (institute.status !== 'PENDING_APPROVAL') {
      throw new BusinessException(
        ErrorCode.SETUP_NOT_COMPLETE,
        `Cannot approve: status is ${institute.status}, must be PENDING_APPROVAL`,
      );
    }

    const record = await this.instituteRepo.updateStatus(id, 'PENDING');

    this.triggerSetupWorkflow(id, record);
    this.eventBus.emit('INSTITUTE.approved', { ...record, scope: 'platform' });
    // Spread the full record so `resellerInstituteStatusChanged` (typed as
    // InstituteModel) can resolve any selected field; reseller filter still
    // matches on `resellerId` which comes through via the spread.
    this.eventBus.emit('INSTITUTE.status_changed', {
      ...record,
      previousStatus: 'PENDING_APPROVAL',
      newStatus: 'PENDING',
    });

    return record;
  }

  async reject(id: string, reason: string) {
    const institute = await this.instituteService.findById(id);
    if (!['PENDING_APPROVAL', 'PENDING'].includes(institute.status)) {
      throw new BusinessException(
        ErrorCode.SETUP_NOT_COMPLETE,
        `Cannot reject: status is ${institute.status}, must be PENDING_APPROVAL or PENDING`,
      );
    }

    const previousStatus = institute.status;
    const record = await this.instituteRepo.updateStatus(id, 'REJECTED');
    // TODO: Store rejection reason — need repo method for settings update

    this.eventBus.emit('INSTITUTE.rejected', { ...record, reason, scope: 'platform' });
    this.eventBus.emit('INSTITUTE.status_changed', {
      ...record,
      previousStatus,
      newStatus: 'REJECTED',
    });

    return record;
  }

  async getStatistics() {
    return this.instituteRepo.statistics();
  }

  /**
   * Reassign an institute to a different reseller. The new reseller must exist and be active
   * (not suspended, not deleted). Emits `INSTITUTE.reseller_reassigned` for downstream audit.
   */
  async reassignReseller(instituteId: string, newResellerId: string): Promise<InstituteRecord> {
    const institute = await this.instituteService.findById(instituteId);

    // Verify the target reseller exists and is active
    const rows = await withAdmin(this.db, mkAdminCtx(), async (tx) =>
      tx
        .select({ id: resellers.id, status: resellers.status, isActive: resellers.isActive })
        .from(resellers)
        .where(eq(resellers.id, newResellerId))
        .limit(1),
    );
    const target = rows[0];
    if (!target) {
      throw new BusinessException(ErrorCode.RESELLER_INVALID, 'Target reseller not found');
    }
    if (target.status !== ResellerStatus.ACTIVE || !target.isActive) {
      throw new BusinessException(
        ErrorCode.RESELLER_INVALID,
        `Target reseller is not active (status: ${target.status})`,
      );
    }

    const previousResellerId = (institute as InstituteRecord).resellerId;
    const record = await this.instituteRepo.updateOwnership(instituteId, {
      resellerId: newResellerId,
    });

    this.eventBus.emit('INSTITUTE.reseller_reassigned', {
      ...record,
      previousResellerId,
      newResellerId,
    });

    return record;
  }

  /**
   * Assign an institute to an institute group (franchise/trust). The group must exist.
   * Emits `INSTITUTE.group_assigned`.
   */
  async assignGroup(instituteId: string, groupId: string): Promise<InstituteRecord> {
    const institute = await this.instituteService.findById(instituteId);

    const rows = await withAdmin(this.db, mkAdminCtx(), async (tx) =>
      tx
        .select({ id: instituteGroups.id })
        .from(instituteGroups)
        .where(eq(instituteGroups.id, groupId))
        .limit(1),
    );
    if (rows.length === 0) {
      throw new NotFoundException(`Institute group ${groupId} not found`);
    }

    const previousGroupId = (institute as InstituteRecord).groupId;
    const record = await this.instituteRepo.updateOwnership(instituteId, { groupId });

    this.eventBus.emit('INSTITUTE.group_assigned', {
      ...record,
      previousGroupId,
      newGroupId: groupId,
    });

    return record;
  }

  /**
   * Read-only academic structure tree for admin viewing. Uses withAdmin to
   * bypass RLS so platform admins can view any institute's academic data.
   * Picks the most recently active academic year — passing an explicit
   * academicYearId is a future enhancement.
   */
  async getAcademicTree(instituteId: string): Promise<AcademicTreeModel> {
    await this.instituteService.findById(instituteId);

    return withAdmin(this.db, mkAdminCtx(), async (tx) => {
      // Pick the most recent academic year for this institute
      const yearRows = await tx
        .select({ id: academicYearsLive.id })
        .from(academicYearsLive)
        .where(eq(academicYearsLive.tenantId, instituteId))
        .orderBy(desc(academicYearsLive.startDate))
        .limit(1);
      const academicYearId = yearRows[0]?.id;

      if (!academicYearId) {
        return { instituteId, academicYearId: null, standards: [] };
      }

      const [standardRows, sectionRows, stdSubjectRows, subjectRows] = await Promise.all([
        tx
          .select({
            id: standardsLive.id,
            name: standardsLive.name,
            numericOrder: standardsLive.numericOrder,
            department: standardsLive.department,
          })
          .from(standardsLive)
          .where(
            and(
              eq(standardsLive.tenantId, instituteId),
              eq(standardsLive.academicYearId, academicYearId),
            ),
          )
          .orderBy(asc(standardsLive.numericOrder)),
        tx
          .select({
            id: sectionsLive.id,
            name: sectionsLive.name,
            stream: sectionsLive.stream,
            standardId: sectionsLive.standardId,
          })
          .from(sectionsLive)
          .where(
            and(
              eq(sectionsLive.tenantId, instituteId),
              eq(sectionsLive.academicYearId, academicYearId),
            ),
          )
          .orderBy(asc(sectionsLive.displayOrder), asc(sectionsLive.name)),
        tx
          .select({
            subjectId: standardSubjectsLive.subjectId,
            standardId: standardSubjectsLive.standardId,
          })
          .from(standardSubjectsLive)
          .where(eq(standardSubjectsLive.tenantId, instituteId)),
        tx
          .select({
            id: subjectsLive.id,
            name: subjectsLive.name,
            shortName: subjectsLive.shortName,
            boardCode: subjectsLive.boardCode,
            type: subjectsLive.type,
          })
          .from(subjectsLive)
          .where(eq(subjectsLive.tenantId, instituteId)),
      ]);

      const sectionsByStandard = new Map<string, typeof sectionRows>();
      for (const s of sectionRows) {
        const list = sectionsByStandard.get(s.standardId) ?? [];
        list.push(s);
        sectionsByStandard.set(s.standardId, list);
      }

      const subjectsById = new Map(subjectRows.map((s) => [s.id, s]));
      const subjectsByStandard = new Map<string, typeof subjectRows>();
      for (const link of stdSubjectRows) {
        const subject = subjectsById.get(link.subjectId);
        if (!subject) continue;
        const list = subjectsByStandard.get(link.standardId) ?? [];
        list.push(subject);
        subjectsByStandard.set(link.standardId, list);
      }

      return {
        instituteId,
        academicYearId,
        standards: standardRows.map((std) => ({
          id: std.id,
          name: std.name as Record<string, string>,
          department: std.department ?? null,
          sections: (sectionsByStandard.get(std.id) ?? []).map((sec) => ({
            id: sec.id,
            name: sec.name as Record<string, string>,
            stream: (sec.stream as Record<string, unknown> | null) ?? null,
          })),
          subjects: (subjectsByStandard.get(std.id) ?? []).map((sub) => ({
            id: sub.id,
            name: sub.name,
            shortName: sub.shortName ?? null,
            boardCode: sub.boardCode ?? null,
            type: sub.type,
          })),
        })),
      };
    });
  }

  /** Remove an institute's group assignment. Emits `INSTITUTE.group_removed`. */
  async removeGroup(instituteId: string): Promise<InstituteRecord> {
    const institute = await this.instituteService.findById(instituteId);
    const previousGroupId = (institute as InstituteRecord).groupId;

    const record = await this.instituteRepo.updateOwnership(instituteId, { groupId: null });

    this.eventBus.emit('INSTITUTE.group_removed', {
      ...record,
      previousGroupId,
    });

    return record;
  }

  /**
   * Retry a failed institute setup workflow. Starts a fresh Temporal workflow run with the
   * same inputs. Idempotent — safe to call multiple times.
   */
  async retrySetup(instituteId: string): Promise<InstituteRecord> {
    const institute = await this.instituteService.findById(instituteId);
    const record = institute as InstituteRecord;

    if (record.setupStatus === 'COMPLETED') {
      throw new BusinessException(
        ErrorCode.SETUP_NOT_COMPLETE,
        'Setup has already completed — cannot retry',
      );
    }

    this.triggerSetupWorkflow(instituteId, record);
    this.eventBus.emit('INSTITUTE.setup_retry_triggered', { ...record });

    return record;
  }

  /**
   * Resolve the primary board affiliation code (lowercase, e.g. 'cbse') for an
   * institute, used by the setup workflow's subject-seeding step. Returns
   * `undefined` when no active affiliation exists.
   */
  private async loadPrimaryBoard(instituteId: string): Promise<string | undefined> {
    return withAdmin(this.db, mkAdminCtx(), async (tx) => {
      const rows = await tx
        .select({ board: instituteAffiliationsLive.board })
        .from(instituteAffiliationsLive)
        .where(eq(instituteAffiliationsLive.tenantId, instituteId))
        .orderBy(asc(instituteAffiliationsLive.validFrom))
        .limit(1);
      return rows[0]?.board ?? undefined;
    });
  }

  /**
   * Kick the Temporal setup workflow. Reads departments/isDemo from the record so
   * retries do not silently downgrade the institute. Board is pulled from the
   * primary affiliation row. Fire-and-forget — Temporal unavailability must not
   * fail the calling mutation.
   */
  private triggerSetupWorkflow(instituteId: string, institute: InstituteRecord) {
    void (async () => {
      try {
        const board = await this.loadPrimaryBoard(instituteId);
        const temporalAddress =
          this.configService.get<string>('TEMPORAL_ADDRESS') ?? 'localhost:7233';
        const connection = await Connection.connect({ address: temporalAddress });
        const client = new Client({ connection });
        const { userId } = getRequestContext();

        await client.workflow.start('InstituteSetupWorkflow', {
          taskQueue: 'institute-setup',
          // WorkflowIdReusePolicy default (AllowDuplicateFailedOnly) lets retry()
          // start a fresh run when the prior run failed or timed out.
          workflowId: `institute-setup-${instituteId}`,
          args: [
            {
              instituteId,
              type: institute.type,
              departments: institute.departments ?? [],
              board,
              isDemo: institute.isDemo ?? false,
              sessionInfo: {},
              creatingUserId: userId,
            },
          ],
        });

        await connection.close();
        this.logger.log(`Temporal workflow started for institute ${instituteId}`);
      } catch (err) {
        this.logger.warn(`Failed to trigger Temporal workflow for ${instituteId}: ${err}`);
      }
    })();
  }
}
