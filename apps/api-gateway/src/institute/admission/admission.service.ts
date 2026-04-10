/**
 * Admission service — enquiry CRM + application lifecycle + statistics (ROV-159).
 *
 * Direct service → Drizzle (no abstract repository).
 */

import { ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AdmissionApplicationStatus,
  EnquirySource,
  EnquiryStatus,
  GuardianRelationship,
} from '@roviq/common-types';
import {
  admissionApplications,
  DRIZZLE_DB,
  type DrizzleDB,
  enquiries,
  withTenant,
} from '@roviq/database';
import { getRequestContext } from '@roviq/request-context';
import { Client as TemporalClient, Connection as TemporalConnection } from '@temporalio/client';
import { and, count, eq, gte, lte, type SQL, sql } from 'drizzle-orm';
import { EventBusService } from '../../common/event-bus.service';
import { decodeCursor, encodeCursor } from '../../common/pagination/relay-pagination.model';
import {
  type ApplicationStatus,
  FUNNEL_STAGES,
  validateApplicationTransition,
} from './application-status-machine';
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

  // ══════════════════════════════════════════════════════════
  // ENQUIRY CRUD
  // ══════════════════════════════════════════════════════════

  async createEnquiry(input: CreateEnquiryInput): Promise<EnquiryModel & { isDuplicate: boolean }> {
    const tenantId = this.getTenantId();
    const actorId = this.getUserId();

    // Auto-dedup: check for same phone + class combo
    const duplicates = await withTenant(this.db, tenantId, async (tx) => {
      return tx
        .select({ id: enquiries.id })
        .from(enquiries)
        .where(
          and(
            eq(enquiries.parentPhone, input.parentPhone),
            eq(enquiries.classRequested, input.classRequested),
          ),
        )
        .limit(1);
    });

    const isDuplicate = duplicates.length > 0;

    const rows = await withTenant(this.db, tenantId, async (tx) => {
      return tx
        .insert(enquiries)
        .values({
          tenantId,
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
    });

    const enquiry = rows[0] as unknown as EnquiryModel;

    this.eventBus.emit('ENQUIRY.created', {
      enquiryId: enquiry.id,
      tenantId,
      studentName: input.studentName,
      classRequested: input.classRequested,
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
    if (filter.status) conditions.push(eq(enquiries.status, filter.status));
    if (filter.source) conditions.push(eq(enquiries.source, filter.source));
    if (filter.classRequested) conditions.push(eq(enquiries.classRequested, filter.classRequested));
    if (filter.assignedTo) conditions.push(eq(enquiries.assignedTo, filter.assignedTo));
    if (filter.followUpFrom) conditions.push(gte(enquiries.followUpDate, filter.followUpFrom));
    if (filter.followUpTo) conditions.push(lte(enquiries.followUpDate, filter.followUpTo));
    if (filter.overdueOnly) {
      conditions.push(
        sql`${enquiries.followUpDate} < CURRENT_DATE AND ${enquiries.status} NOT IN (${EnquiryStatus.ENROLLED}, ${EnquiryStatus.LOST}, ${EnquiryStatus.DROPPED})`,
      );
    }
    if (filter.search) {
      conditions.push(
        sql`to_tsvector('simple', coalesce(${enquiries.studentName}, '') || ' ' || coalesce(${enquiries.parentName}, '')) @@ plainto_tsquery('simple', ${filter.search})`,
      );
    }

    let cursorCondition: ReturnType<typeof sql> | undefined;
    if (filter.after) {
      const decoded = decodeCursor(filter.after);
      cursorCondition = sql`${enquiries.id} > ${decoded.id}`;
    }

    const where = and(
      ...(conditions.length > 0 ? conditions : []),
      ...(cursorCondition ? [cursorCondition] : []),
    );

    return withTenant(this.db, tenantId, async (tx) => {
      const countWhere = conditions.length > 0 ? and(...conditions) : undefined;
      const [{ total }] = await tx.select({ total: count() }).from(enquiries).where(countWhere);

      // Sort: overdue follow-ups first, then by follow_up_date ascending
      const rows = await tx
        .select()
        .from(enquiries)
        .where(where)
        .orderBy(
          sql`CASE WHEN ${enquiries.followUpDate} < CURRENT_DATE THEN 0 ELSE 1 END`,
          sql`${enquiries.followUpDate} ASC NULLS LAST`,
          enquiries.id,
        )
        .limit(limit + 1);

      const hasNextPage = rows.length > limit;
      if (hasNextPage) rows.pop();

      const edges = rows.map((row) => ({
        node: row as unknown as EnquiryModel,
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

    const rows = await withTenant(this.db, tenantId, async (tx) => {
      return tx.update(enquiries).set(updates).where(eq(enquiries.id, id)).returning();
    });

    if (rows.length === 0) {
      throw new NotFoundException('Enquiry not found');
    }

    return rows[0] as unknown as EnquiryModel;
  }

  async convertEnquiryToApplication(
    enquiryId: string,
    standardId: string,
    academicYearId: string,
  ): Promise<ApplicationModel> {
    const tenantId = this.getTenantId();
    const actorId = this.getUserId();

    // Load enquiry
    const enqRows = await withTenant(this.db, tenantId, async (tx) => {
      return tx.select().from(enquiries).where(eq(enquiries.id, enquiryId)).limit(1);
    });

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

    const appRows = await withTenant(this.db, tenantId, async (tx) => {
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
    });

    this.logger.log(`Enquiry ${enquiryId} converted to application ${appRows[0].id}`);
    return appRows[0] as unknown as ApplicationModel;
  }

  // ══════════════════════════════════════════════════════════
  // APPLICATION CRUD
  // ══════════════════════════════════════════════════════════

  async createApplication(input: CreateApplicationInput): Promise<ApplicationModel> {
    const tenantId = this.getTenantId();
    const actorId = this.getUserId();

    const rows = await withTenant(this.db, tenantId, async (tx) => {
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
    });

    this.logger.log(`Application created: ${rows[0].id}`);
    return rows[0] as unknown as ApplicationModel;
  }

  async getApplication(id: string): Promise<ApplicationModel> {
    const tenantId = this.getTenantId();
    const rows = await withTenant(this.db, tenantId, async (tx) => {
      return tx
        .select()
        .from(admissionApplications)
        .where(eq(admissionApplications.id, id))
        .limit(1);
    });

    if (rows.length === 0) {
      throw new NotFoundException('Application not found');
    }
    return rows[0] as unknown as ApplicationModel;
  }

  async updateApplication(id: string, input: UpdateApplicationInput): Promise<ApplicationModel> {
    const tenantId = this.getTenantId();
    const actorId = this.getUserId();

    // Load current status for transition validation
    const current = await withTenant(this.db, tenantId, async (tx) => {
      return tx
        .select({ status: admissionApplications.status })
        .from(admissionApplications)
        .where(eq(admissionApplications.id, id))
        .limit(1);
    });

    if (current.length === 0) {
      throw new NotFoundException('Application not found');
    }

    const oldStatus = current[0].status;
    validateApplicationTransition(
      oldStatus as ApplicationStatus,
      input.status as ApplicationStatus,
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

    const rows = await withTenant(this.db, tenantId, async (tx) => {
      return tx
        .update(admissionApplications)
        .set(updates)
        .where(eq(admissionApplications.id, id))
        .returning();
    });

    // Emit status change for subscription
    this.eventBus.emit('APPLICATION.status_changed', {
      applicationId: id,
      oldStatus,
      newStatus: input.status,
      tenantId,
    });

    this.logger.log(`Application ${id}: ${oldStatus} → ${input.status}`);
    return rows[0] as unknown as ApplicationModel;
  }

  /**
   * Approve an application by transitioning fee_paid → enrolled
   * and triggering the StudentAdmissionWorkflow via Temporal.
   */
  async approveAndEnroll(id: string): Promise<ApplicationModel> {
    const tenantId = this.getTenantId();

    // Validate transition first (fee_paid → enrolled)
    const current = await this.getApplication(id);
    validateApplicationTransition(
      current.status as ApplicationStatus,
      AdmissionApplicationStatus.ENROLLED,
    );

    // Start Temporal workflow
    const address = this.config.get<string>('TEMPORAL_ADDRESS', 'localhost:7233');
    const connection = await TemporalConnection.connect({ address });
    const client = new TemporalClient({ connection });

    const workflowId = `student-admission-${id}-${Date.now()}`;
    await client.workflow.start('StudentAdmissionWorkflow', {
      taskQueue: 'student-admission',
      workflowId,
      workflowExecutionTimeout: '5 minutes',
      args: [{ applicationId: id, tenantId }],
    });

    this.logger.log(`Started StudentAdmissionWorkflow: ${workflowId} for application ${id}`);
    await connection.close();

    // The workflow will update the application status to 'enrolled' and set studentProfileId.
    // For now, do the status transition directly so the resolver returns the updated state.
    return this.updateApplication(id, { status: AdmissionApplicationStatus.ENROLLED });
  }

  async rejectApplication(id: string, reason?: string): Promise<ApplicationModel> {
    // Store rejection reason in formData since there's no dedicated column
    const input: UpdateApplicationInput = { status: AdmissionApplicationStatus.REJECTED };
    if (reason) {
      const current = await this.getApplication(id);
      input.formData = {
        ...(current.formData as Record<string, unknown>),
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
    if (filter.status) conditions.push(eq(admissionApplications.status, filter.status));
    if (filter.academicYearId) {
      conditions.push(eq(admissionApplications.academicYearId, filter.academicYearId));
    }
    if (filter.standardId) {
      conditions.push(eq(admissionApplications.standardId, filter.standardId));
    }
    if (filter.isRteApplication !== undefined) {
      conditions.push(eq(admissionApplications.isRteApplication, filter.isRteApplication));
    }

    let cursorCondition: ReturnType<typeof sql> | undefined;
    if (filter.after) {
      const decoded = decodeCursor(filter.after);
      cursorCondition = sql`${admissionApplications.id} > ${decoded.id}`;
    }

    const where = and(
      ...(conditions.length > 0 ? conditions : []),
      ...(cursorCondition ? [cursorCondition] : []),
    );

    return withTenant(this.db, tenantId, async (tx) => {
      const countWhere = conditions.length > 0 ? and(...conditions) : undefined;
      const [{ total }] = await tx
        .select({ total: count() })
        .from(admissionApplications)
        .where(countWhere);

      const rows = await tx
        .select()
        .from(admissionApplications)
        .where(where)
        .orderBy(admissionApplications.createdAt)
        .limit(limit + 1);

      const hasNextPage = rows.length > limit;
      if (hasNextPage) rows.pop();

      const edges = rows.map((row) => ({
        node: row as unknown as ApplicationModel,
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

  async statistics(): Promise<AdmissionStatisticsModel> {
    const tenantId = this.getTenantId();

    return withTenant(this.db, tenantId, async (tx) => {
      const [{ totalEnq }] = await tx.select({ totalEnq: count() }).from(enquiries);
      const [{ totalApp }] = await tx.select({ totalApp: count() }).from(admissionApplications);

      // Funnel: count applications at or past each stage
      const statusCounts = await tx
        .select({ status: admissionApplications.status, cnt: count() })
        .from(admissionApplications)
        .groupBy(admissionApplications.status);

      const statusMap = new Map(statusCounts.map((r) => [r.status, r.cnt]));

      const funnel = FUNNEL_STAGES.map((stage) => ({
        stage,
        count: statusMap.get(stage) ?? 0,
      }));

      // Source breakdown
      const enquiryBySrc = await tx
        .select({ source: enquiries.source, cnt: count() })
        .from(enquiries)
        .groupBy(enquiries.source);

      const bySource = enquiryBySrc.map((r) => ({
        source: r.source,
        enquiryCount: r.cnt,
        applicationCount: 0,
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
