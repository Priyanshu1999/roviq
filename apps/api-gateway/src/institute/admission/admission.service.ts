/**
 * Admission service — enquiry CRM + application lifecycle + statistics (ROV-159).
 *
 * Direct service → Drizzle (no abstract repository).
 */

import { ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ADMISSION_APPLICATION_STATE_MACHINE,
  AdmissionApplicationStatus,
  EnquirySource,
  EnquiryStatus,
  FUNNEL_STAGES,
  GuardianRelationship,
} from '@roviq/common-types';
import {
  academicYearsLive,
  admissionApplications,
  admissionApplicationsLive,
  DRIZZLE_DB,
  type DrizzleDB,
  enquiries,
  enquiriesLive,
  mkInstituteCtx,
  standardsLive,
  tenantSequences,
  withTenant,
} from '@roviq/database';
import { EVENT_PATTERNS } from '@roviq/nats-jetstream';
import { getRequestContext } from '@roviq/request-context';
import { Client as TemporalClient, Connection as TemporalConnection } from '@temporalio/client';
import type { InferSelectModel } from 'drizzle-orm';
import { and, count, eq, gte, lte, type SQL, sql } from 'drizzle-orm';
import { EventBusService } from '../../common/event-bus.service';
import { decodeCursor, encodeCursor } from '../../common/pagination/relay-pagination.model';
import type { AdmissionStatisticsFilterInput } from './dto/admission-statistics-filter.input';
import type {
  CreateApplicationInput,
  UpdateApplicationInput,
} from './dto/create-application.input';
import type { CreateEnquiryInput } from './dto/create-enquiry.input';
import type { ApplicationFilterInput, EnquiryFilterInput } from './dto/enquiry-filter.input';
import type { UpdateEnquiryInput } from './dto/update-enquiry.input';
import type { AdmissionStatisticsModel } from './models/admission-statistics.model';
import type { ApplicationModel } from './models/application.model';
import type { EnquiryModel } from './models/enquiry.model';

/**
 * Drizzle row types — single source of truth for the shape returned by
 * `db.select().from(...)`. The mapper functions below pluck the subset of
 * fields the GraphQL `EnquiryModel`/`ApplicationModel` exposes, eliminating
 * the `as unknown as Model` casts banned by the [NTESC] hard rule.
 */
type EnquiryRow = InferSelectModel<typeof enquiries>;
type ApplicationRow = InferSelectModel<typeof admissionApplications>;

function toEnquiryModel(row: EnquiryRow): EnquiryModel {
  return {
    id: row.id,
    tenantId: row.tenantId,
    enquiryNumber: row.enquiryNumber,
    studentName: row.studentName,
    dateOfBirth: row.dateOfBirth,
    gender: row.gender,
    classRequested: row.classRequested,
    academicYearId: row.academicYearId,
    parentName: row.parentName,
    parentPhone: row.parentPhone,
    parentEmail: row.parentEmail,
    parentRelation: row.parentRelation,
    source: row.source,
    referredBy: row.referredBy,
    assignedTo: row.assignedTo,
    previousSchool: row.previousSchool,
    previousBoard: row.previousBoard,
    siblingInSchool: row.siblingInSchool ?? false,
    siblingAdmissionNo: row.siblingAdmissionNo,
    specialNeeds: row.specialNeeds,
    notes: row.notes,
    status: row.status,
    followUpDate: row.followUpDate,
    lastContactedAt: row.lastContactedAt,
    convertedToApplicationId: row.convertedToApplicationId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toApplicationModel(row: ApplicationRow): ApplicationModel {
  return {
    id: row.id,
    tenantId: row.tenantId,
    enquiryId: row.enquiryId,
    academicYearId: row.academicYearId,
    standardId: row.standardId,
    sectionId: row.sectionId,
    formData: row.formData,
    status: row.status,
    isRteApplication: row.isRteApplication,
    testScore: row.testScore,
    interviewScore: row.interviewScore,
    meritRank: row.meritRank,
    rteLotteryRank: row.rteLotteryRank,
    offeredAt: row.offeredAt,
    offerExpiresAt: row.offerExpiresAt,
    offerAcceptedAt: row.offerAcceptedAt,
    studentProfileId: row.studentProfileId,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class AdmissionService {
  private readonly logger = new Logger(AdmissionService.name);

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDB,
    private readonly eventBus: EventBusService,
    private readonly config: ConfigService,
  ) {}

  private getTenantId(): string {
    const { tenantId } = getRequestContext();
    if (!tenantId) throw new Error('Tenant context is required');
    return tenantId;
  }

  private getUserId(): string {
    const { userId } = getRequestContext();
    if (!userId) throw new Error('User context is required');
    return userId;
  }

  /**
   * Generate the next human-readable enquiry number (e.g. `ENQ-000123`).
   * Uses the atomic `next_sequence_value()` function with a per-tenant
   * `enq_no` row in `tenant_sequences`, creating it on first use.
   */
  private async generateEnquiryNumber(tenantId: string): Promise<string> {
    return withTenant(this.db, mkInstituteCtx(tenantId, 'service:admission'), async (tx) => {
      await tx
        .insert(tenantSequences)
        .values({
          tenantId,
          sequenceName: 'enq_no',
          currentValue: 0n,
          formatTemplate: 'ENQ-{value:06d}',
        })
        .onConflictDoNothing();
      const result = await tx.execute(
        sql`SELECT * FROM next_sequence_value(${tenantId}::uuid, 'enq_no')`,
      );
      const row = result.rows[0] as { next_val: string; formatted: string };
      return row.formatted || `ENQ-${row.next_val}`;
    });
  }

  // ══════════════════════════════════════════════════════════
  // ENQUIRY CRUD
  // ══════════════════════════════════════════════════════════

  async createEnquiry(input: CreateEnquiryInput): Promise<EnquiryModel & { isDuplicate: boolean }> {
    const tenantId = this.getTenantId();
    const actorId = this.getUserId();

    // Auto-dedup: check for same phone + class combo
    const duplicates = await withTenant(
      this.db,
      mkInstituteCtx(tenantId, 'service:admission'),
      async (tx) => {
        return tx
          .select({ id: enquiriesLive.id })
          .from(enquiriesLive)
          .where(
            and(
              eq(enquiriesLive.parentPhone, input.parentPhone),
              eq(enquiriesLive.classRequested, input.classRequested),
            ),
          )
          .limit(1);
      },
    );

    const isDuplicate = duplicates.length > 0;

    const enquiryNumber = await this.generateEnquiryNumber(tenantId);

    const rows = await withTenant(
      this.db,
      mkInstituteCtx(tenantId, 'service:admission'),
      async (tx) => {
        return tx
          .insert(enquiries)
          .values({
            tenantId,
            enquiryNumber,
            studentName: input.studentName,
            dateOfBirth: input.dateOfBirth ?? null,
            gender: input.gender ?? null,
            classRequested: input.classRequested,
            academicYearId: input.academicYearId ?? null,
            parentName: input.parentName,
            parentPhone: input.parentPhone,
            parentEmail: input.parentEmail ?? null,
            parentRelation: input.parentRelation ?? GuardianRelationship.FATHER,
            source: input.source ?? EnquirySource.WALK_IN,
            referredBy: input.referredBy ?? null,
            assignedTo: input.assignedTo ?? null,
            previousSchool: input.previousSchool ?? null,
            previousBoard: input.previousBoard ?? null,
            siblingInSchool: input.siblingInSchool ?? false,
            siblingAdmissionNo: input.siblingAdmissionNo ?? null,
            specialNeeds: input.specialNeeds ?? null,
            notes: input.notes ?? null,
            status: EnquiryStatus.NEW,
            followUpDate: input.followUpDate ?? null,
            createdBy: actorId,
            updatedBy: actorId,
          })
          .returning();
      },
    );

    const enquiry = toEnquiryModel(rows[0]);

    // Spread the full record so the `@Subscription(() => EnquiryModel)`
    // resolver can serve any selected field (id, etc.) without null-field
    // errors. The enquiryId alias + isDuplicate stay for downstream NATS
    // consumers that already depend on them.
    this.eventBus.emit(EVENT_PATTERNS.ENQUIRY.created, {
      ...enquiry,
      enquiryId: enquiry.id,
      tenantId,
      isDuplicate,
    });

    this.logger.log(`Enquiry created: ${enquiry.id} (duplicate: ${isDuplicate})`);

    return { ...enquiry, isDuplicate };
  }

  async listEnquiries(filter: EnquiryFilterInput): Promise<{
    edges: { node: EnquiryModel; cursor: string }[];
    totalCount: number;
    pageInfo: {
      hasNextPage: boolean;
      hasPreviousPage: boolean;
      startCursor: string | null;
      endCursor: string | null;
    };
  }> {
    const tenantId = this.getTenantId();
    const limit = filter.first ?? 25;

    const conditions: SQL[] = [];
    if (filter.status) conditions.push(eq(enquiriesLive.status, filter.status));
    if (filter.source) conditions.push(eq(enquiriesLive.source, filter.source));
    if (filter.classRequested)
      conditions.push(eq(enquiriesLive.classRequested, filter.classRequested));
    if (filter.assignedTo) conditions.push(eq(enquiriesLive.assignedTo, filter.assignedTo));
    if (filter.followUpFrom) conditions.push(gte(enquiriesLive.followUpDate, filter.followUpFrom));
    if (filter.followUpTo) conditions.push(lte(enquiriesLive.followUpDate, filter.followUpTo));
    if (filter.overdueOnly) {
      conditions.push(
        sql`${enquiriesLive.followUpDate} < CURRENT_DATE AND ${enquiriesLive.status} NOT IN (${EnquiryStatus.ENROLLED}, ${EnquiryStatus.LOST}, ${EnquiryStatus.DROPPED})`,
      );
    }
    if (filter.search) {
      conditions.push(
        sql`to_tsvector('simple', coalesce(${enquiriesLive.studentName}, '') || ' ' || coalesce(${enquiriesLive.parentName}, '')) @@ plainto_tsquery('simple', ${filter.search})`,
      );
    }

    let cursorCondition: ReturnType<typeof sql> | undefined;
    if (filter.after) {
      const decoded = decodeCursor(filter.after);
      cursorCondition = sql`${enquiriesLive.id} > ${decoded.id}`;
    }

    const where = and(
      ...(conditions.length > 0 ? conditions : []),
      ...(cursorCondition ? [cursorCondition] : []),
    );

    return withTenant(this.db, mkInstituteCtx(tenantId, 'service:admission'), async (tx) => {
      const countWhere = conditions.length > 0 ? and(...conditions) : undefined;
      const [{ total }] = await tx.select({ total: count() }).from(enquiriesLive).where(countWhere);

      // Sort: overdue follow-ups first, then by follow_up_date ascending
      const rows = await tx
        .select()
        .from(enquiriesLive)
        .where(where)
        .orderBy(
          sql`CASE WHEN ${enquiriesLive.followUpDate} < CURRENT_DATE THEN 0 ELSE 1 END`,
          sql`${enquiriesLive.followUpDate} ASC NULLS LAST`,
          enquiriesLive.id,
        )
        .limit(limit + 1);

      const hasNextPage = rows.length > limit;
      if (hasNextPage) rows.pop();

      const edges = rows.map((row) => ({
        node: toEnquiryModel(row),
        cursor: encodeCursor({ id: row.id }),
      }));

      return {
        edges,
        totalCount: total,
        pageInfo: {
          hasNextPage,
          hasPreviousPage: !!filter.after,
          startCursor: edges[0]?.cursor ?? null,
          endCursor: edges[edges.length - 1]?.cursor ?? null,
        },
      };
    });
  }

  async updateEnquiry(id: string, input: UpdateEnquiryInput): Promise<EnquiryModel> {
    const tenantId = this.getTenantId();
    const actorId = this.getUserId();

    const updates: Record<string, unknown> = { updatedBy: actorId };
    const fields = [
      'studentName',
      'classRequested',
      'parentName',
      'parentPhone',
      'parentEmail',
      'status',
      'followUpDate',
      'assignedTo',
      'notes',
      'source',
      'referredBy',
      'siblingInSchool',
      'siblingAdmissionNo',
      'specialNeeds',
    ] as const;
    for (const field of fields) {
      if (input[field] !== undefined) updates[field] = input[field];
    }

    if (input.status === EnquiryStatus.CONTACTED || input.status === EnquiryStatus.CAMPUS_VISITED) {
      updates.lastContactedAt = new Date();
    }

    const rows = await withTenant(
      this.db,
      mkInstituteCtx(tenantId, 'service:admission'),
      async (tx) => {
        return tx.update(enquiries).set(updates).where(eq(enquiries.id, id)).returning();
      },
    );

    if (rows.length === 0) {
      throw new NotFoundException('Enquiry not found');
    }

    return toEnquiryModel(rows[0]);
  }

  async convertEnquiryToApplication(
    enquiryId: string,
    standardId: string,
    academicYearId: string,
  ): Promise<ApplicationModel> {
    const tenantId = this.getTenantId();
    const actorId = this.getUserId();

    // Load enquiry
    const enqRows = await withTenant(
      this.db,
      mkInstituteCtx(tenantId, 'service:admission'),
      async (tx) => {
        return tx.select().from(enquiriesLive).where(eq(enquiriesLive.id, enquiryId)).limit(1);
      },
    );

    if (enqRows.length === 0) {
      throw new NotFoundException('Enquiry not found');
    }

    const enq = enqRows[0];

    if (enq.convertedToApplicationId) {
      throw new ConflictException('Enquiry already converted to an application');
    }

    // Create application from enquiry data
    const formData = {
      studentName: enq.studentName,
      dateOfBirth: enq.dateOfBirth,
      gender: enq.gender,
      parentName: enq.parentName,
      parentPhone: enq.parentPhone,
      parentEmail: enq.parentEmail,
      parentRelation: enq.parentRelation,
      previousSchool: enq.previousSchool,
      previousBoard: enq.previousBoard,
      specialNeeds: enq.specialNeeds,
    };

    const appRows = await withTenant(
      this.db,
      mkInstituteCtx(tenantId, 'service:admission'),
      async (tx) => {
        const apps = await tx
          .insert(admissionApplications)
          .values({
            tenantId,
            enquiryId,
            academicYearId,
            standardId,
            formData,
            status: AdmissionApplicationStatus.SUBMITTED,
            isRteApplication: false,
            createdBy: actorId,
            updatedBy: actorId,
          })
          .returning();

        // Update enquiry
        await tx
          .update(enquiries)
          .set({
            status: EnquiryStatus.APPLICATION_SUBMITTED,
            convertedToApplicationId: apps[0].id,
            updatedBy: actorId,
          })
          .where(eq(enquiries.id, enquiryId));

        return apps;
      },
    );

    this.logger.log(`Enquiry ${enquiryId} converted to application ${appRows[0].id}`);
    return toApplicationModel(appRows[0]);
  }

  // ══════════════════════════════════════════════════════════
  // APPLICATION CRUD
  // ══════════════════════════════════════════════════════════

  async createApplication(input: CreateApplicationInput): Promise<ApplicationModel> {
    const tenantId = this.getTenantId();
    const actorId = this.getUserId();

    // Validate the referenced standard exists in this tenant before writing.
    // The FK would catch a missing row, but the domain error surfaces a clearer
    // message to the caller and avoids a round-trip for a generic 500.
    const standardRows = await withTenant(
      this.db,
      mkInstituteCtx(tenantId, 'service:admission'),
      async (tx) => {
        return tx
          .select({ id: standardsLive.id })
          .from(standardsLive)
          .where(eq(standardsLive.id, input.standardId))
          .limit(1);
      },
    );
    if (standardRows.length === 0) {
      throw new NotFoundException(`Standard ${input.standardId} not found in this institute`);
    }

    // Applications must target an ACTIVE academic year — admissions for
    // archived/completing years are not accepted, and planning years are not
    // yet open.
    const yearRows = await withTenant(
      this.db,
      mkInstituteCtx(tenantId, 'service:admission'),
      async (tx) => {
        return tx
          .select({ id: academicYearsLive.id, isActive: academicYearsLive.isActive })
          .from(academicYearsLive)
          .where(eq(academicYearsLive.id, input.academicYearId))
          .limit(1);
      },
    );
    if (yearRows.length === 0) {
      throw new NotFoundException(
        `Academic year ${input.academicYearId} not found in this institute`,
      );
    }
    if (!yearRows[0].isActive) {
      throw new ConflictException(
        `Academic year ${input.academicYearId} is not active — applications cannot be accepted`,
      );
    }

    const rows = await withTenant(
      this.db,
      mkInstituteCtx(tenantId, 'service:admission'),
      async (tx) => {
        return tx
          .insert(admissionApplications)
          .values({
            tenantId,
            enquiryId: input.enquiryId ?? null,
            academicYearId: input.academicYearId,
            standardId: input.standardId,
            sectionId: input.sectionId ?? null,
            formData: input.formData,
            status: AdmissionApplicationStatus.SUBMITTED,
            isRteApplication: input.isRteApplication ?? false,
            createdBy: actorId,
            updatedBy: actorId,
          })
          .returning();
      },
    );

    this.logger.log(`Application created: ${rows[0].id}`);
    return toApplicationModel(rows[0]);
  }

  async getApplication(id: string): Promise<ApplicationModel> {
    const tenantId = this.getTenantId();
    const rows = await withTenant(
      this.db,
      mkInstituteCtx(tenantId, 'service:admission'),
      async (tx) => {
        return tx
          .select()
          .from(admissionApplicationsLive)
          .where(eq(admissionApplicationsLive.id, id))
          .limit(1);
      },
    );

    if (rows.length === 0) {
      throw new NotFoundException('Application not found');
    }
    return toApplicationModel(rows[0]);
  }

  async updateApplication(id: string, input: UpdateApplicationInput): Promise<ApplicationModel> {
    const tenantId = this.getTenantId();
    const actorId = this.getUserId();

    // Load current status for transition validation
    const current = await withTenant(
      this.db,
      mkInstituteCtx(tenantId, 'service:admission'),
      async (tx) => {
        return tx
          .select({ status: admissionApplicationsLive.status })
          .from(admissionApplicationsLive)
          .where(eq(admissionApplicationsLive.id, id))
          .limit(1);
      },
    );

    if (current.length === 0) {
      throw new NotFoundException('Application not found');
    }

    const oldStatus = current[0].status;
    ADMISSION_APPLICATION_STATE_MACHINE.assertTransition(
      oldStatus as AdmissionApplicationStatus,
      input.status as AdmissionApplicationStatus,
    );

    const updates: Record<string, unknown> = {
      status: input.status,
      updatedBy: actorId,
    };

    if (input.sectionId !== undefined) updates.sectionId = input.sectionId;
    if (input.formData !== undefined) updates.formData = input.formData;
    if (input.testScore !== undefined) updates.testScore = input.testScore;
    if (input.interviewScore !== undefined) updates.interviewScore = input.interviewScore;
    if (input.meritRank !== undefined) updates.meritRank = input.meritRank;

    // Auto-set timestamps based on status
    if (input.status === AdmissionApplicationStatus.OFFER_MADE) updates.offeredAt = new Date();
    if (input.status === AdmissionApplicationStatus.OFFER_ACCEPTED)
      updates.offerAcceptedAt = new Date();

    const rows = await withTenant(
      this.db,
      mkInstituteCtx(tenantId, 'service:admission'),
      async (tx) => {
        return tx
          .update(admissionApplications)
          .set(updates)
          .where(eq(admissionApplications.id, id))
          .returning();
      },
    );

    // Emit status change for subscription
    this.eventBus.emit(EVENT_PATTERNS.APPLICATION.status_changed, {
      applicationId: id,
      oldStatus,
      newStatus: input.status,
      tenantId,
    });

    this.logger.log(`Application ${id}: ${oldStatus} → ${input.status}`);
    return toApplicationModel(rows[0]);
  }

  /**
   * Trigger the StudentAdmissionWorkflow via Temporal.
   *
   * This does NOT flip the application status itself — that responsibility
   * belongs to the workflow's `updateApplicationEnrolled` activity, which
   * sets `status='enrolled'` AND `student_profile_id` in a single write
   * once every upstream step (user creation, student profile, academics,
   * guardian linking) has succeeded. Writing ENROLLED here would:
   *   - publish `applicationStatusChanged` before the student exists
   *     (subscriptions get a phantom transition)
   *   - leave `student_profile_id` NULL on the application row, breaking
   *     downstream lookups
   *   - race the workflow's own write
   *
   * The resolver therefore returns the *current* application row (still
   * FEE_PAID); the UI tracks the in-flight workflow via the pending
   * indicator and reconciles on the `applicationStatusChanged` push.
   */
  async approveAndEnroll(id: string): Promise<ApplicationModel> {
    const tenantId = this.getTenantId();

    // Validate that the current state can legally enrol — surfaces a clear
    // domain error before we spend a workflow execution slot.
    const current = await this.getApplication(id);
    ADMISSION_APPLICATION_STATE_MACHINE.assertTransition(
      current.status as AdmissionApplicationStatus,
      AdmissionApplicationStatus.ENROLLED,
    );

    const address = this.config.get<string>('TEMPORAL_ADDRESS', 'localhost:7233');
    const connection = await TemporalConnection.connect({ address });
    try {
      const client = new TemporalClient({ connection });
      // Stable workflow ID per application keeps Temporal's de-dup honest:
      // a duplicate approveApplication call returns the same workflow rather
      // than starting a parallel one. `WorkflowIdReusePolicy` defaults to
      // ALLOW_DUPLICATE_FAILED_ONLY, which is exactly what we want here.
      const workflowId = `student-admission-${id}`;
      await client.workflow.start('StudentAdmissionWorkflow', {
        taskQueue: 'student-admission',
        workflowId,
        workflowExecutionTimeout: '5 minutes',
        args: [{ applicationId: id, tenantId }],
      });
      this.logger.log(`Started StudentAdmissionWorkflow: ${workflowId} for application ${id}`);
    } finally {
      await connection.close();
    }

    return current;
  }

  async rejectApplication(id: string, reason?: string): Promise<ApplicationModel> {
    // Store rejection reason in formData since there's no dedicated column
    const input: UpdateApplicationInput = { status: AdmissionApplicationStatus.REJECTED };
    if (reason) {
      const current = await this.getApplication(id);
      input.formData = {
        ...current.formData,
        _rejectionReason: reason,
        _rejectedAt: new Date().toISOString(),
      };
    }
    return this.updateApplication(id, input);
  }

  async listApplications(filter: ApplicationFilterInput): Promise<{
    edges: { node: ApplicationModel; cursor: string }[];
    totalCount: number;
    pageInfo: {
      hasNextPage: boolean;
      hasPreviousPage: boolean;
      startCursor: string | null;
      endCursor: string | null;
    };
  }> {
    const tenantId = this.getTenantId();
    const limit = filter.first ?? 25;

    const conditions: SQL[] = [];
    if (filter.status) conditions.push(eq(admissionApplicationsLive.status, filter.status));
    if (filter.academicYearId) {
      conditions.push(eq(admissionApplicationsLive.academicYearId, filter.academicYearId));
    }
    if (filter.standardId) {
      conditions.push(eq(admissionApplicationsLive.standardId, filter.standardId));
    }
    if (filter.isRteApplication !== undefined) {
      conditions.push(eq(admissionApplicationsLive.isRteApplication, filter.isRteApplication));
    }

    let cursorCondition: ReturnType<typeof sql> | undefined;
    if (filter.after) {
      const decoded = decodeCursor(filter.after);
      cursorCondition = sql`${admissionApplicationsLive.id} > ${decoded.id}`;
    }

    const where = and(
      ...(conditions.length > 0 ? conditions : []),
      ...(cursorCondition ? [cursorCondition] : []),
    );

    return withTenant(this.db, mkInstituteCtx(tenantId, 'service:admission'), async (tx) => {
      const countWhere = conditions.length > 0 ? and(...conditions) : undefined;
      const [{ total }] = await tx
        .select({ total: count() })
        .from(admissionApplicationsLive)
        .where(countWhere);

      const rows = await tx
        .select()
        .from(admissionApplicationsLive)
        .where(where)
        .orderBy(admissionApplicationsLive.createdAt)
        .limit(limit + 1);

      const hasNextPage = rows.length > limit;
      if (hasNextPage) rows.pop();

      const edges = rows.map((row) => ({
        node: toApplicationModel(row),
        cursor: encodeCursor({ id: row.id }),
      }));

      return {
        edges,
        totalCount: total,
        pageInfo: {
          hasNextPage,
          hasPreviousPage: !!filter.after,
          startCursor: edges[0]?.cursor ?? null,
          endCursor: edges[edges.length - 1]?.cursor ?? null,
        },
      };
    });
  }

  // ══════════════════════════════════════════════════════════
  // ADMISSION STATISTICS
  // ══════════════════════════════════════════════════════════

  async statistics(filter?: AdmissionStatisticsFilterInput): Promise<AdmissionStatisticsModel> {
    const tenantId = this.getTenantId();

    // Build inclusive date-range predicates against `created_at`, anchored
    // to **Asia/Kolkata** (the canonical timezone for every Indian institute).
    // We push the conversion into Postgres via `AT TIME ZONE` rather than
    // synthesising a `Date` here so the comparison happens against the row's
    // own timestamp in IST. Without this, `to: '2026-04-15'` would match in
    // UTC and silently drop events created between 23:30–24:00 IST.
    //
    //   from → IST midnight at the start of the day  (>=)
    //   to   → IST 23:59:59.999999 at the end of the day  (<=)
    //
    // `from`/`to` are validated by class-validator as `IsDateString()` so
    // they are safe to interpolate into SQL via `sql`.
    const enquiryWindow = (() => {
      const conds: SQL[] = [];
      if (filter?.from) {
        conds.push(
          sql`${enquiriesLive.createdAt} >= (${filter.from}::date AT TIME ZONE 'Asia/Kolkata')`,
        );
      }
      if (filter?.to) {
        conds.push(
          sql`${enquiriesLive.createdAt} < ((${filter.to}::date + INTERVAL '1 day') AT TIME ZONE 'Asia/Kolkata')`,
        );
      }
      return conds.length > 0 ? and(...conds) : undefined;
    })();

    const appWindow = (() => {
      const conds: SQL[] = [];
      if (filter?.from) {
        conds.push(
          sql`${admissionApplicationsLive.createdAt} >= (${filter.from}::date AT TIME ZONE 'Asia/Kolkata')`,
        );
      }
      if (filter?.to) {
        conds.push(
          sql`${admissionApplicationsLive.createdAt} < ((${filter.to}::date + INTERVAL '1 day') AT TIME ZONE 'Asia/Kolkata')`,
        );
      }
      return conds.length > 0 ? and(...conds) : undefined;
    })();

    return withTenant(this.db, mkInstituteCtx(tenantId, 'service:admission'), async (tx) => {
      const [{ totalEnq }] = await tx
        .select({ totalEnq: count() })
        .from(enquiriesLive)
        .where(enquiryWindow);
      const [{ totalApp }] = await tx
        .select({ totalApp: count() })
        .from(admissionApplicationsLive)
        .where(appWindow);

      // Funnel: count applications at or past each stage
      const statusCounts = await tx
        .select({ status: admissionApplicationsLive.status, cnt: count() })
        .from(admissionApplicationsLive)
        .where(appWindow)
        .groupBy(admissionApplicationsLive.status);

      const statusMap = new Map(statusCounts.map((r) => [r.status, r.cnt]));

      const funnel = FUNNEL_STAGES.map((stage) => ({
        stage,
        count: statusMap.get(stage) ?? 0,
      }));

      // Source breakdown — enquiryCount per source plus the number of those
      // enquiries that converted to an application. The applicationCount is
      // computed via a LEFT JOIN to admission_applications keyed on the
      // enquiry FK so counts correctly reflect cross-over between tables.
      const bySourceRows = await tx
        .select({
          source: enquiriesLive.source,
          enquiryCount: sql<number>`COUNT(${enquiriesLive.id})::int`,
          applicationCount: sql<number>`COUNT(${admissionApplicationsLive.id})::int`,
        })
        .from(enquiriesLive)
        .leftJoin(
          admissionApplicationsLive,
          eq(admissionApplicationsLive.enquiryId, enquiriesLive.id),
        )
        .where(enquiryWindow)
        .groupBy(enquiriesLive.source);

      const bySource = bySourceRows.map((r) => ({
        source: r.source,
        enquiryCount: r.enquiryCount,
        applicationCount: r.applicationCount,
      }));

      // Conversion rates
      const enrolledCount = statusMap.get(AdmissionApplicationStatus.ENROLLED) ?? 0;
      const enquiryToApplicationRate = totalEnq > 0 ? totalApp / totalEnq : 0;
      const applicationToEnrolledRate = totalApp > 0 ? enrolledCount / totalApp : 0;

      return {
        totalEnquiries: totalEnq,
        totalApplications: totalApp,
        funnel,
        bySource,
        enquiryToApplicationRate,
        applicationToEnrolledRate,
      };
    });
  }
}
