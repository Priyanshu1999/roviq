/**
 * Student CRUD service (ROV-154).
 *
 * Direct service → Drizzle (no abstract repository).
 * Auth/user creation uses direct DB stubs (same pattern as bulk import).
 * TODO: Replace user creation with NATS calls when Identity Service is ready.
 */
import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { getRequestContext } from '@roviq/common-types';
import {
  type AdmissionNumberConfig,
  academicYears,
  DRIZZLE_DB,
  type DrizzleDB,
  instituteConfigs,
  memberships,
  phoneNumbers,
  roles,
  sections,
  standards,
  studentAcademics,
  studentProfiles,
  tenantSequences,
  userDocuments,
  userProfiles,
  users,
  withAdmin,
  withTenant,
} from '@roviq/database';
import { and, count, eq, ilike, or, type SQL, sql } from 'drizzle-orm';
import { EventBusService } from '../../common/event-bus.service';
import { decodeCursor, encodeCursor } from '../../common/pagination/relay-pagination.model';
import { resolveAdmissionPrefix, resolveAdmissionYear } from './admission-number';
import type { CreateStudentInput } from './dto/create-student.input';
import type { StudentFilterInput } from './dto/student-filter.input';
import type { UpdateStudentInput } from './dto/update-student.input';
import type { StudentModel } from './models/student.model';
import type { StudentDocumentModel } from './models/student-document.model';
import type { StudentStatisticsModel } from './models/student-statistics.model';
import { type AcademicStatus, validateStatusTransition } from './student-status-machine';

@Injectable()
export class StudentService {
  private readonly logger = new Logger(StudentService.name);

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDB,
    private readonly eventBus: EventBusService,
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

  // ── CREATE ────────────────────────────────────────────────

  async create(input: CreateStudentInput): Promise<StudentModel> {
    const tenantId = this.getTenantId();
    const actorId = this.getUserId();

    // 1. Find or create user (NATS stub — direct DB)
    let userId: string;
    const phone = input.phone;
    if (phone) {
      const existing = await withAdmin(this.db, async (tx) => {
        return tx
          .select({ userId: phoneNumbers.userId })
          .from(phoneNumbers)
          .where(and(eq(phoneNumbers.countryCode, '+91'), eq(phoneNumbers.number, phone)))
          .limit(1);
      });
      if (existing.length > 0) {
        userId = existing[0].userId;
      } else {
        userId = await this.createUser(input, actorId);
      }
    } else {
      userId = await this.createUser(input, actorId);
    }

    // 2. Create user_profile (idempotent)
    await withAdmin(this.db, async (tx) => {
      await tx
        .insert(userProfiles)
        .values({
          userId,
          firstName: input.firstName,
          lastName: input.lastName ?? null,
          nameLocal: input.nameLocal ?? null,
          gender: input.gender ?? null,
          dateOfBirth: input.dateOfBirth ?? null,
          bloodGroup: input.bloodGroup ?? null,
          religion: input.religion ?? null,
          motherTongue: input.motherTongue ?? null,
          nationality: 'Indian',
          createdBy: actorId,
          updatedBy: actorId,
        })
        .onConflictDoNothing();
    });

    // 3. Find student role + create membership
    const studentRole = await withTenant(this.db, tenantId, async (tx) => {
      return tx
        .select({ id: roles.id })
        .from(roles)
        .where(
          and(
            eq(roles.tenantId, tenantId),
            sql`${roles.name}->>'en' = 'student' OR ${roles.name}->>'en' = 'Student'`,
          ),
        )
        .limit(1);
    });

    if (studentRole.length === 0) {
      throw new NotFoundException('Student role not found for this institute');
    }

    const newMemberships = await withTenant(this.db, tenantId, async (tx) => {
      return tx
        .insert(memberships)
        .values({
          userId,
          tenantId,
          roleId: studentRole[0].id,
          status: 'ACTIVE',
          abilities: [],
          createdBy: actorId,
          updatedBy: actorId,
        })
        .onConflictDoNothing()
        .returning({ id: memberships.id });
    });

    // If membership already exists, find it
    let membershipId: string;
    if (newMemberships.length > 0) {
      membershipId = newMemberships[0].id;
    } else {
      const existing = await withTenant(this.db, tenantId, async (tx) => {
        return tx
          .select({ id: memberships.id })
          .from(memberships)
          .where(
            and(
              eq(memberships.userId, userId),
              eq(memberships.tenantId, tenantId),
              eq(memberships.roleId, studentRole[0].id),
            ),
          )
          .limit(1);
      });
      membershipId = existing[0].id;
    }

    // 4. Generate admission number
    const admissionNumber = await this.generateAdmissionNumber(tenantId, input.standardId);

    // 5. Create student_profile
    const admissionDate = input.admissionDate ?? new Date().toISOString().split('T')[0];
    const newProfiles = await withTenant(this.db, tenantId, async (tx) => {
      return tx
        .insert(studentProfiles)
        .values({
          userId,
          membershipId,
          tenantId,
          admissionNumber,
          admissionDate,
          admissionClass: input.admissionClass ?? null,
          admissionType: input.admissionType ?? 'new',
          academicStatus: 'enrolled',
          socialCategory: input.socialCategory ?? 'general',
          caste: input.caste ?? null,
          isMinority: input.isMinority ?? false,
          minorityType: input.minorityType ?? null,
          isBpl: input.isBpl ?? false,
          isCwsn: input.isCwsn ?? false,
          cwsnType: input.cwsnType ?? null,
          isRteAdmitted: input.isRteAdmitted ?? false,
          rteCertificate: input.rteCertificate ?? null,
          previousSchoolName: input.previousSchoolName ?? null,
          previousSchoolBoard: input.previousSchoolBoard ?? null,
          previousSchoolUdise: input.previousSchoolUdise ?? null,
          incomingTcNumber: input.incomingTcNumber ?? null,
          incomingTcDate: input.incomingTcDate ?? null,
          createdBy: actorId,
          updatedBy: actorId,
        })
        .returning({ id: studentProfiles.id });
    });

    const studentProfileId = newProfiles[0].id;

    // 6. Create student_academics (initial enrollment)
    await withTenant(this.db, tenantId, async (tx) => {
      await tx.insert(studentAcademics).values({
        studentProfileId,
        academicYearId: input.academicYearId,
        standardId: input.standardId,
        sectionId: input.sectionId,
        tenantId,
        createdBy: actorId,
        updatedBy: actorId,
      });

      // Increment section strength
      await tx
        .update(sections)
        .set({ currentStrength: sql`${sections.currentStrength} + 1` })
        .where(eq(sections.id, input.sectionId));
    });

    // 7. Emit event
    this.eventBus.emit('STUDENT.admitted', {
      studentProfileId,
      membershipId,
      standardId: input.standardId,
      sectionId: input.sectionId,
      tenantId,
    });

    this.logger.log(`Student created: ${studentProfileId} (admission: ${admissionNumber})`);

    return this.findById(studentProfileId);
  }

  // ── READ ──────────────────────────────────────────────────

  /**
   * Returns all uploaded documents for a single student. The student is
   * verified to belong to the current tenant via `withTenant` (RLS on
   * `student_profiles`); the actual `user_documents` rows are then read via
   * `withAdmin` because that table is platform-level (no RLS).
   *
   * Used by the Documents tab on the student detail page (ROV-167).
   * Returns the most-recently uploaded documents first.
   */
  async listDocumentsForStudent(studentProfileId: string): Promise<StudentDocumentModel[]> {
    const tenantId = this.getTenantId();

    // 1. Verify the student belongs to this tenant and resolve their userId.
    const studentRows = await withTenant(this.db, tenantId, async (tx) => {
      return tx
        .select({ userId: studentProfiles.userId })
        .from(studentProfiles)
        .where(eq(studentProfiles.id, studentProfileId))
        .limit(1);
    });

    if (studentRows.length === 0) {
      throw new NotFoundException({
        message: 'Student not found',
        code: 'STUDENT_NOT_FOUND',
      });
    }

    const userId = studentRows[0].userId;

    // 2. Read documents from the platform-level user_documents table.
    return withAdmin(this.db, async (tx) => {
      const rows = await tx
        .select({
          id: userDocuments.id,
          userId: userDocuments.userId,
          type: userDocuments.type,
          description: userDocuments.description,
          fileUrls: userDocuments.fileUrls,
          referenceNumber: userDocuments.referenceNumber,
          isVerified: userDocuments.isVerified,
          verifiedAt: userDocuments.verifiedAt,
          verifiedBy: userDocuments.verifiedBy,
          rejectionReason: userDocuments.rejectionReason,
          expiryDate: userDocuments.expiryDate,
          createdAt: userDocuments.createdAt,
          updatedAt: userDocuments.updatedAt,
        })
        .from(userDocuments)
        .where(eq(userDocuments.userId, userId))
        .orderBy(sql`${userDocuments.createdAt} DESC`);

      return rows.map((row) => ({
        ...row,
        verifiedAt: row.verifiedAt ? row.verifiedAt.toISOString() : null,
        expiryDate: row.expiryDate ?? null,
      })) as unknown as StudentDocumentModel[];
    });
  }

  async findById(id: string): Promise<StudentModel> {
    const tenantId = this.getTenantId();

    const rows = await withTenant(this.db, tenantId, async (tx) => {
      return tx
        .select({
          id: studentProfiles.id,
          tenantId: studentProfiles.tenantId,
          userId: studentProfiles.userId,
          membershipId: studentProfiles.membershipId,
          admissionNumber: studentProfiles.admissionNumber,
          admissionDate: studentProfiles.admissionDate,
          admissionClass: studentProfiles.admissionClass,
          admissionType: studentProfiles.admissionType,
          academicStatus: studentProfiles.academicStatus,
          socialCategory: studentProfiles.socialCategory,
          caste: studentProfiles.caste,
          isMinority: studentProfiles.isMinority,
          minorityType: studentProfiles.minorityType,
          isBpl: studentProfiles.isBpl,
          isCwsn: studentProfiles.isCwsn,
          cwsnType: studentProfiles.cwsnType,
          isRteAdmitted: studentProfiles.isRteAdmitted,
          rteCertificate: studentProfiles.rteCertificate,
          tcIssued: studentProfiles.tcIssued,
          tcNumber: studentProfiles.tcNumber,
          tcIssuedDate: studentProfiles.tcIssuedDate,
          tcReason: studentProfiles.tcReason,
          dateOfLeaving: studentProfiles.dateOfLeaving,
          previousSchoolName: studentProfiles.previousSchoolName,
          previousSchoolBoard: studentProfiles.previousSchoolBoard,
          medicalInfo: studentProfiles.medicalInfo,
          version: studentProfiles.version,
          createdAt: studentProfiles.createdAt,
          updatedAt: studentProfiles.updatedAt,
          // user_profile join
          firstName: userProfiles.firstName,
          lastName: userProfiles.lastName,
          nameLocal: userProfiles.nameLocal,
          gender: userProfiles.gender,
          dateOfBirth: userProfiles.dateOfBirth,
          bloodGroup: userProfiles.bloodGroup,
          religion: userProfiles.religion,
          motherTongue: userProfiles.motherTongue,
          profileImageUrl: userProfiles.profileImageUrl,
          // current academic
          currentStudentAcademicId: studentAcademics.id,
          currentStandardId: studentAcademics.standardId,
          currentSectionId: studentAcademics.sectionId,
          currentAcademicYearId: studentAcademics.academicYearId,
          rollNumber: studentAcademics.rollNumber,
        })
        .from(studentProfiles)
        .innerJoin(userProfiles, eq(userProfiles.userId, studentProfiles.userId))
        .leftJoin(
          studentAcademics,
          and(
            eq(studentAcademics.studentProfileId, studentProfiles.id),
            eq(
              studentAcademics.academicYearId,
              sql`(SELECT id FROM academic_years WHERE tenant_id = ${tenantId} AND is_active = true LIMIT 1)`,
            ),
          ),
        )
        .where(eq(studentProfiles.id, id))
        .limit(1);
    });

    if (rows.length === 0) {
      throw new NotFoundException({ message: 'Student not found', code: 'STUDENT_NOT_FOUND' });
    }

    return rows[0] as unknown as StudentModel;
  }

  async list(filter: StudentFilterInput): Promise<{
    edges: { node: StudentModel; cursor: string }[];
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

    // Resolve academic year (default to active)
    let academicYearId = filter.academicYearId;
    if (!academicYearId) {
      const activeYear = await withTenant(this.db, tenantId, async (tx) => {
        return tx
          .select({ id: academicYears.id })
          .from(academicYears)
          .where(eq(academicYears.isActive, true))
          .limit(1);
      });
      if (activeYear.length > 0) {
        academicYearId = activeYear[0].id;
      }
    }

    const conditions: SQL[] = [];
    if (academicYearId) {
      conditions.push(eq(studentAcademics.academicYearId, academicYearId));
    }
    if (filter.standardId) {
      conditions.push(eq(studentAcademics.standardId, filter.standardId));
    }
    if (filter.sectionId) {
      conditions.push(eq(studentAcademics.sectionId, filter.sectionId));
    }
    if (filter.academicStatus) {
      conditions.push(eq(studentProfiles.academicStatus, filter.academicStatus));
    }
    if (filter.socialCategory) {
      conditions.push(eq(studentProfiles.socialCategory, filter.socialCategory));
    }
    if (filter.isRteAdmitted !== undefined) {
      conditions.push(eq(studentProfiles.isRteAdmitted, filter.isRteAdmitted));
    }
    if (filter.gender) {
      conditions.push(eq(userProfiles.gender, filter.gender));
    }

    // Search: tsvector on user_profiles + trigram on admission_number
    if (filter.search) {
      const searchTerm = filter.search;
      const searchCondition = or(
        sql`${userProfiles.searchVector} @@ plainto_tsquery('simple', ${searchTerm})`,
        ilike(studentProfiles.admissionNumber, `%${searchTerm}%`),
      );
      if (searchCondition) conditions.push(searchCondition);
    }

    // Cursor decode
    let cursorCondition: ReturnType<typeof sql> | undefined;
    if (filter.after) {
      const decoded = decodeCursor(filter.after);
      cursorCondition = sql`${studentProfiles.id} > ${decoded.id}`;
    }

    const where = and(
      ...(conditions.length > 0 ? conditions : []),
      ...(cursorCondition ? [cursorCondition] : []),
    );

    return withTenant(this.db, tenantId, async (tx) => {
      // Count total (without cursor)
      const countWhere = conditions.length > 0 ? and(...conditions) : undefined;
      const [{ total }] = await tx
        .select({ total: count() })
        .from(studentProfiles)
        .innerJoin(userProfiles, eq(userProfiles.userId, studentProfiles.userId))
        .leftJoin(studentAcademics, eq(studentAcademics.studentProfileId, studentProfiles.id))
        .where(countWhere);

      // Fetch rows
      const rows = await tx
        .select({
          id: studentProfiles.id,
          tenantId: studentProfiles.tenantId,
          userId: studentProfiles.userId,
          membershipId: studentProfiles.membershipId,
          admissionNumber: studentProfiles.admissionNumber,
          admissionDate: studentProfiles.admissionDate,
          admissionClass: studentProfiles.admissionClass,
          admissionType: studentProfiles.admissionType,
          academicStatus: studentProfiles.academicStatus,
          socialCategory: studentProfiles.socialCategory,
          caste: studentProfiles.caste,
          isMinority: studentProfiles.isMinority,
          minorityType: studentProfiles.minorityType,
          isBpl: studentProfiles.isBpl,
          isCwsn: studentProfiles.isCwsn,
          cwsnType: studentProfiles.cwsnType,
          isRteAdmitted: studentProfiles.isRteAdmitted,
          rteCertificate: studentProfiles.rteCertificate,
          tcIssued: studentProfiles.tcIssued,
          tcNumber: studentProfiles.tcNumber,
          tcIssuedDate: studentProfiles.tcIssuedDate,
          tcReason: studentProfiles.tcReason,
          dateOfLeaving: studentProfiles.dateOfLeaving,
          previousSchoolName: studentProfiles.previousSchoolName,
          previousSchoolBoard: studentProfiles.previousSchoolBoard,
          medicalInfo: studentProfiles.medicalInfo,
          version: studentProfiles.version,
          createdAt: studentProfiles.createdAt,
          updatedAt: studentProfiles.updatedAt,
          firstName: userProfiles.firstName,
          lastName: userProfiles.lastName,
          nameLocal: userProfiles.nameLocal,
          gender: userProfiles.gender,
          dateOfBirth: userProfiles.dateOfBirth,
          bloodGroup: userProfiles.bloodGroup,
          religion: userProfiles.religion,
          motherTongue: userProfiles.motherTongue,
          profileImageUrl: userProfiles.profileImageUrl,
          currentStudentAcademicId: studentAcademics.id,
          currentStandardId: studentAcademics.standardId,
          currentSectionId: studentAcademics.sectionId,
          currentAcademicYearId: studentAcademics.academicYearId,
          rollNumber: studentAcademics.rollNumber,
        })
        .from(studentProfiles)
        .innerJoin(userProfiles, eq(userProfiles.userId, studentProfiles.userId))
        .leftJoin(studentAcademics, eq(studentAcademics.studentProfileId, studentProfiles.id))
        .where(where)
        .orderBy(studentProfiles.id)
        .limit(limit + 1); // +1 for hasNextPage

      const hasNextPage = rows.length > limit;
      if (hasNextPage) rows.pop();

      const edges = rows.map((row) => ({
        node: row as unknown as StudentModel,
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

  // ── UPDATE ────────────────────────────────────────────────

  async update(id: string, input: UpdateStudentInput): Promise<StudentModel> {
    const tenantId = this.getTenantId();
    const actorId = this.getUserId();

    // Validate status transition if changing
    if (input.academicStatus) {
      await this.validateStatusChange(tenantId, id, input);
    }

    // Optimistic concurrency: update student_profile WHERE version = expected
    const profileUpdates = this.buildStudentProfileUpdates(input, actorId);

    const updated = await withTenant(this.db, tenantId, async (tx) => {
      return tx
        .update(studentProfiles)
        .set({
          ...profileUpdates,
          version: sql`${studentProfiles.version} + 1`,
        })
        .where(and(eq(studentProfiles.id, id), eq(studentProfiles.version, input.version)))
        .returning({ id: studentProfiles.id });
    });

    if (updated.length === 0) {
      await this.throwVersionConflict(tenantId, id);
    }

    // Update user_profile fields if any provided
    await this.applyUserProfileUpdates(tenantId, id, input, actorId);

    // Emit student.left event for departure statuses
    this.emitLeftEventIfApplicable(id, input, tenantId);

    return this.findById(id);
  }

  // ── DELETE ────────────────────────────────────────────────

  async delete(id: string): Promise<boolean> {
    const tenantId = this.getTenantId();
    const actorId = this.getUserId();

    // Check for active enrollments in current year
    const activeEnrollments = await withTenant(this.db, tenantId, async (tx) => {
      return tx
        .select({ id: studentAcademics.id })
        .from(studentAcademics)
        .innerJoin(academicYears, eq(academicYears.id, studentAcademics.academicYearId))
        .where(and(eq(studentAcademics.studentProfileId, id), eq(academicYears.isActive, true)))
        .limit(1);
    });

    if (activeEnrollments.length > 0) {
      throw new UnprocessableEntityException({
        message: 'Cannot delete student with active enrollments in the current academic year',
        code: 'HAS_ACTIVE_ENROLLMENTS',
      });
    }

    const deleted = await withTenant(this.db, tenantId, async (tx) => {
      return tx
        .update(studentProfiles)
        .set({ deletedAt: new Date(), deletedBy: actorId, updatedBy: actorId })
        .where(and(eq(studentProfiles.id, id), sql`${studentProfiles.deletedAt} IS NULL`))
        .returning({ id: studentProfiles.id });
    });

    if (deleted.length === 0) {
      throw new NotFoundException({ message: 'Student not found', code: 'STUDENT_NOT_FOUND' });
    }

    return true;
  }

  // ── STATISTICS ────────────────────────────────────────────

  async statistics(): Promise<StudentStatisticsModel> {
    const tenantId = this.getTenantId();

    return withTenant(this.db, tenantId, async (tx) => {
      const [{ total }] = await tx.select({ total: count() }).from(studentProfiles);

      const byStatus = await tx
        .select({ status: studentProfiles.academicStatus, count: count() })
        .from(studentProfiles)
        .groupBy(studentProfiles.academicStatus);

      const bySection = await tx
        .select({ sectionId: studentAcademics.sectionId, count: count() })
        .from(studentAcademics)
        .innerJoin(academicYears, eq(academicYears.id, studentAcademics.academicYearId))
        .where(eq(academicYears.isActive, true))
        .groupBy(studentAcademics.sectionId);

      const byStandard = await tx
        .select({ standardId: studentAcademics.standardId, count: count() })
        .from(studentAcademics)
        .innerJoin(academicYears, eq(academicYears.id, studentAcademics.academicYearId))
        .where(eq(academicYears.isActive, true))
        .groupBy(studentAcademics.standardId);

      const byGender = await tx
        .select({ gender: userProfiles.gender, count: count() })
        .from(studentProfiles)
        .innerJoin(userProfiles, eq(userProfiles.userId, studentProfiles.userId))
        .groupBy(userProfiles.gender);

      const byCategory = await tx
        .select({ category: studentProfiles.socialCategory, count: count() })
        .from(studentProfiles)
        .groupBy(studentProfiles.socialCategory);

      return {
        total,
        byStatus: byStatus.map((r) => ({ status: r.status, count: r.count })),
        bySection: bySection.map((r) => ({ sectionId: r.sectionId, count: r.count })),
        byStandard: byStandard.map((r) => ({ standardId: r.standardId, count: r.count })),
        byGender: byGender.map((r) => ({ gender: r.gender ?? 'unknown', count: r.count })),
        byCategory: byCategory.map((r) => ({ category: r.category, count: r.count })),
      };
    });
  }

  // ── PRIVATE HELPERS ───────────────────────────────────────

  private async validateStatusChange(
    tenantId: string,
    id: string,
    input: UpdateStudentInput,
  ): Promise<void> {
    const current = await withTenant(this.db, tenantId, async (tx) => {
      return tx
        .select({
          academicStatus: studentProfiles.academicStatus,
          tcIssued: studentProfiles.tcIssued,
        })
        .from(studentProfiles)
        .where(eq(studentProfiles.id, id))
        .limit(1);
    });

    if (current.length === 0) {
      throw new NotFoundException({ message: 'Student not found', code: 'STUDENT_NOT_FOUND' });
    }

    validateStatusTransition(
      current[0].academicStatus as AcademicStatus,
      input.academicStatus as AcademicStatus,
      { tcIssued: input.tcIssued ?? current[0].tcIssued },
    );
  }

  private buildStudentProfileUpdates(
    input: UpdateStudentInput,
    actorId: string,
  ): Record<string, unknown> {
    const updates: Record<string, unknown> = { updatedBy: actorId };
    const fields = [
      'socialCategory',
      'caste',
      'isMinority',
      'minorityType',
      'isBpl',
      'isCwsn',
      'cwsnType',
      'isRteAdmitted',
      'rteCertificate',
      'academicStatus',
      'tcIssued',
      'tcNumber',
      'tcIssuedDate',
      'tcReason',
      'dateOfLeaving',
    ] as const;
    for (const field of fields) {
      if (input[field] !== undefined) updates[field] = input[field];
    }
    return updates;
  }

  private async throwVersionConflict(tenantId: string, id: string): Promise<never> {
    const exists = await withTenant(this.db, tenantId, async (tx) => {
      return tx
        .select({ id: studentProfiles.id })
        .from(studentProfiles)
        .where(eq(studentProfiles.id, id))
        .limit(1);
    });

    if (exists.length === 0) {
      throw new NotFoundException({ message: 'Student not found', code: 'STUDENT_NOT_FOUND' });
    }
    throw new ConflictException({
      message: 'Concurrent modification detected — please reload and try again',
      code: 'CONCURRENT_MODIFICATION',
    });
  }

  private async applyUserProfileUpdates(
    tenantId: string,
    id: string,
    input: UpdateStudentInput,
    actorId: string,
  ): Promise<void> {
    const updates: Record<string, unknown> = {};
    const fields = [
      'firstName',
      'lastName',
      'nameLocal',
      'gender',
      'dateOfBirth',
      'bloodGroup',
      'religion',
      'motherTongue',
    ] as const;
    for (const field of fields) {
      if (input[field] !== undefined) updates[field] = input[field];
    }

    if (Object.keys(updates).length === 0) return;

    const profile = await withTenant(this.db, tenantId, async (tx) => {
      return tx
        .select({ userId: studentProfiles.userId })
        .from(studentProfiles)
        .where(eq(studentProfiles.id, id))
        .limit(1);
    });

    await withAdmin(this.db, async (tx) => {
      await tx
        .update(userProfiles)
        .set({ ...updates, updatedBy: actorId })
        .where(eq(userProfiles.userId, profile[0].userId));
    });
  }

  private static readonly LEFT_STATUSES = new Set([
    'transferred_out',
    'dropped_out',
    'withdrawn',
    'expelled',
  ]);

  private emitLeftEventIfApplicable(id: string, input: UpdateStudentInput, tenantId: string): void {
    if (input.academicStatus && StudentService.LEFT_STATUSES.has(input.academicStatus)) {
      this.eventBus.emit('STUDENT.left', {
        studentProfileId: id,
        reason: input.academicStatus,
        tcNumber: input.tcNumber ?? null,
        tenantId,
      });
    }
  }

  private async createUser(input: CreateStudentInput, _actorId: string): Promise<string> {
    // TODO: Replace with NATS call to Identity Service (IDENTITY.createUser)
    const email = `student-${Date.now()}@roviq.placeholder`;
    const username = `student-${Date.now()}`;

    const newUsers = await withAdmin(this.db, async (tx) => {
      return tx
        .insert(users)
        .values({ email, username, passwordHash: '$placeholder-student-create' })
        .returning({ id: users.id });
    });

    const userId = newUsers[0].id;

    // Create phone record if provided
    const phoneForRecord = input.phone;
    if (phoneForRecord) {
      await withAdmin(this.db, async (tx) => {
        await tx
          .insert(phoneNumbers)
          .values({
            userId,
            countryCode: '+91',
            number: phoneForRecord,
            isPrimary: true,
            label: 'personal',
          })
          .onConflictDoNothing();
      });
    }

    return userId;
  }

  private async generateAdmissionNumber(tenantId: string, standardId: string): Promise<string> {
    // Get institute config for admission number format
    const config = await withTenant(this.db, tenantId, async (tx) => {
      return tx
        .select({ admissionNumberConfig: instituteConfigs.admissionNumberConfig })
        .from(instituteConfigs)
        .limit(1);
    });

    const admConfig: AdmissionNumberConfig = config[0]?.admissionNumberConfig ?? {
      format: '{prefix}{value:04d}',
      year_format: 'YYYY',
      prefixes: {},
      no_prefix_from_class: 2,
    };

    // Get standard's numeric_order for prefix resolution
    const std = await withTenant(this.db, tenantId, async (tx) => {
      return tx
        .select({ numericOrder: standards.numericOrder })
        .from(standards)
        .where(eq(standards.id, standardId))
        .limit(1);
    });

    const numericOrder = std[0]?.numericOrder ?? 1;
    const prefix = resolveAdmissionPrefix(admConfig, numericOrder);
    const year = resolveAdmissionYear(admConfig);

    // Ensure sequence exists with correct prefix/format
    const formatTemplate = admConfig.format.replace('{year}', year);

    await withTenant(this.db, tenantId, async (tx) => {
      await tx
        .insert(tenantSequences)
        .values({
          tenantId,
          sequenceName: 'adm_no',
          currentValue: 0n,
          prefix: prefix || null,
          formatTemplate,
        })
        .onConflictDoNothing();

      // Update prefix if it changed (e.g., different standard)
      await tx
        .update(tenantSequences)
        .set({ prefix: prefix || null })
        .where(
          and(eq(tenantSequences.tenantId, tenantId), eq(tenantSequences.sequenceName, 'adm_no')),
        );
    });

    // Atomic increment
    const result = await withTenant(this.db, tenantId, async (tx) => {
      const rows = await tx.execute(
        sql`SELECT * FROM next_sequence_value(${tenantId}::uuid, 'adm_no')`,
      );
      return rows.rows[0] as { next_val: string; formatted: string } | undefined;
    });

    if (!result) {
      throw new Error('Failed to generate admission number');
    }

    return result.formatted || `ADM-${result.next_val}`;
  }
}
