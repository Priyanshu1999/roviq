/**
 * Staff service (ROV-157).
 *
 * Handles staff CRUD, employee_id generation, and NATS events.
 * Uses withTenant/withAdmin for RLS enforcement.
 */

import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { DefaultRoles, EmploymentType } from '@roviq/common-types';
import {
  DRIZZLE_DB,
  type DrizzleDB,
  memberships,
  mkAdminCtx,
  mkInstituteCtx,
  phoneNumbers,
  rolesLive,
  staffProfiles,
  staffProfilesLive,
  tenantSequences,
  userProfiles,
  withAdmin,
  withTenant,
} from '@roviq/database';
import { EVENT_PATTERNS, type EventPattern } from '@roviq/nats-jetstream';
import { getRequestContext } from '@roviq/request-context';
import { and, count, eq, isNull, sql } from 'drizzle-orm';
import { IdentityService } from '../../auth/identity.service';
import type { CreateStaffInput } from './dto/create-staff.input';
import type { ListStaffFilterInput } from './dto/list-staff-filter.input';
import type { UpdateStaffInput } from './dto/update-staff.input';
import type { StaffModel } from './models/staff.model';

@Injectable()
export class StaffService {
  private readonly logger = new Logger(StaffService.name);

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDB,
    @Inject('JETSTREAM_CLIENT') private readonly natsClient: ClientProxy,
    private readonly identityService: IdentityService,
  ) {}

  private get tenantId(): string {
    const { tenantId } = getRequestContext();
    if (!tenantId) throw new Error('Tenant context required');
    return tenantId;
  }

  private get userId(): string {
    return getRequestContext().userId;
  }

  private emitEvent(pattern: EventPattern, data: Record<string, unknown>) {
    this.natsClient.emit(pattern, data).subscribe({
      error: (err) => this.logger.warn(`Failed to emit ${pattern}`, err),
    });
  }

  /**
   * Standard projection for the staff list and detail queries — joins
   * `staff_profiles_live` (security_invoker view that hides soft-deleted
   * rows) with `user_profiles` so the GraphQL StaffModel gets resolved
   * name + photo + DOB + gender on every read. Centralised so findById
   * and list select the same shape. Writes (INSERT/UPDATE RETURNING) target
   * the base `staff_profiles` table directly because RETURNING can't go
   * through a view.
   */
  private staffSelectLive() {
    return {
      id: staffProfilesLive.id,
      userId: staffProfilesLive.userId,
      membershipId: staffProfilesLive.membershipId,
      firstName: userProfiles.firstName,
      lastName: userProfiles.lastName,
      gender: userProfiles.gender,
      dateOfBirth: userProfiles.dateOfBirth,
      profileImageUrl: userProfiles.profileImageUrl,
      employeeId: staffProfilesLive.employeeId,
      designation: staffProfilesLive.designation,
      department: staffProfilesLive.department,
      dateOfJoining: staffProfilesLive.dateOfJoining,
      dateOfLeaving: staffProfilesLive.dateOfLeaving,
      employmentType: staffProfilesLive.employmentType,
      isClassTeacher: staffProfilesLive.isClassTeacher,
      socialCategory: staffProfilesLive.socialCategory,
      specialization: staffProfilesLive.specialization,
      version: staffProfilesLive.version,
      createdAt: staffProfilesLive.createdAt,
      updatedAt: staffProfilesLive.updatedAt,
    };
  }

  async findById(id: string): Promise<StaffModel> {
    const tenantId = this.tenantId;
    const rows = await withTenant(
      this.db,
      mkInstituteCtx(tenantId, 'service:staff'),
      async (tx) => {
        return tx
          .select(this.staffSelectLive())
          .from(staffProfilesLive)
          .innerJoin(userProfiles, eq(userProfiles.userId, staffProfilesLive.userId))
          .where(eq(staffProfilesLive.id, id))
          .limit(1);
      },
    );
    if (rows.length === 0) throw new NotFoundException(`Staff profile ${id} not found`);
    return rows[0] as unknown as StaffModel;
  }

  async list(filter: ListStaffFilterInput): Promise<StaffModel[]> {
    const tenantId = this.tenantId;
    return withTenant(this.db, mkInstituteCtx(tenantId, 'service:staff'), async (tx) => {
      const conditions = [];
      if (filter.department) conditions.push(eq(staffProfilesLive.department, filter.department));
      if (filter.designation)
        conditions.push(eq(staffProfilesLive.designation, filter.designation));
      if (filter.employmentType)
        conditions.push(eq(staffProfilesLive.employmentType, filter.employmentType));
      if (filter.isClassTeacher != null)
        conditions.push(eq(staffProfilesLive.isClassTeacher, filter.isClassTeacher));
      // Search uses the multilingual search_vector GIN index — `plainto_tsquery`
      // matches names in any locale because the generated tsvector flattens
      // every value of the i18nText jsonb on insert.
      if (filter.search) {
        conditions.push(
          sql`${userProfiles.searchVector} @@ plainto_tsquery('simple', ${filter.search})`,
        );
      }

      const limit = filter.first ?? 20;

      const rows = await tx
        .select(this.staffSelectLive())
        .from(staffProfilesLive)
        .innerJoin(userProfiles, eq(userProfiles.userId, staffProfilesLive.userId))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .limit(limit);
      return rows as unknown as StaffModel[];
    });
  }

  async create(input: CreateStaffInput) {
    const tenantId = this.tenantId;
    const actorId = this.userId;

    // PRD §2.3 rule 2: date_of_joining must not be in the future
    if (input.dateOfJoining) {
      const today = new Date().toISOString().split('T')[0];
      if (input.dateOfJoining > today) {
        throw new BadRequestException('date_of_joining must not be in the future');
      }
    }

    const email = input.email ?? `staff-${Date.now()}@roviq.placeholder`;
    const username = `staff-${tenantId.slice(0, 8)}-${Date.now()}`;
    const phone = input.phone ? { countryCode: '+91', number: input.phone } : undefined;

    const { userId: newUserId } = await this.identityService.createUser({
      email,
      username,
      phone,
    });
    const newUser = { id: newUserId };

    // Create phone record if provided
    if (input.phone) {
      const phone = input.phone;
      await withAdmin(this.db, mkAdminCtx('service:staff'), async (tx) => {
        await tx
          .insert(phoneNumbers)
          .values({
            userId: newUser.id,
            countryCode: '+91',
            number: phone,
            isPrimary: true,
            label: 'personal',
          })
          .onConflictDoNothing();
      });
    }

    // Create user_profile
    await withAdmin(this.db, mkAdminCtx('service:staff'), async (tx) => {
      await tx
        .insert(userProfiles)
        .values({
          userId: newUser.id,
          firstName: input.firstName,
          lastName: input.lastName ?? null,
          gender: input.gender ?? null,
          dateOfBirth: input.dateOfBirth ?? null,
          nationality: 'Indian',
          createdBy: actorId,
          updatedBy: actorId,
        })
        .onConflictDoNothing();
    });

    // Find teacher role using DefaultRoles constant — read via `roles_live`
    // to skip soft-deleted role rows.
    const staffRole = await withTenant(
      this.db,
      mkInstituteCtx(tenantId, 'service:staff'),
      async (tx) => {
        return tx
          .select({ id: rolesLive.id })
          .from(rolesLive)
          .where(
            and(
              eq(rolesLive.tenantId, tenantId),
              sql`${rolesLive.name}->>'en' = ${DefaultRoles.Teacher}`,
            ),
          )
          .limit(1);
      },
    );

    if (staffRole.length === 0)
      throw new NotFoundException('Teacher role not found for this institute');

    // Create membership
    const newMembership = await withTenant(
      this.db,
      mkInstituteCtx(tenantId, 'service:staff'),
      async (tx) => {
        return tx
          .insert(memberships)
          .values({
            userId: newUser.id,
            tenantId,
            roleId: staffRole[0].id,
            status: 'ACTIVE',
            abilities: [],
            createdBy: actorId,
            updatedBy: actorId,
          })
          .returning({ id: memberships.id });
      },
    );

    // Generate employee_id via tenant_sequences
    const employeeId = await withTenant(
      this.db,
      mkInstituteCtx(tenantId, 'service:staff'),
      async (tx) => {
        await tx
          .insert(tenantSequences)
          .values({
            tenantId,
            sequenceName: 'employee_id',
            currentValue: 0n,
            formatTemplate: 'EMP-{value:04d}',
          })
          .onConflictDoNothing();

        const result = await tx.execute(
          sql`SELECT * FROM next_sequence_value(${tenantId}::uuid, 'employee_id')`,
        );
        const row = result.rows[0] as { next_val: string; formatted: string };
        return row.formatted || `EMP-${row.next_val}`;
      },
    );

    // Create staff_profile
    const profile = await withTenant(
      this.db,
      mkInstituteCtx(tenantId, 'service:staff'),
      async (tx) => {
        const rows = await tx
          .insert(staffProfiles)
          .values({
            userId: newUser.id,
            membershipId: newMembership[0].id,
            tenantId,
            employeeId,
            designation: input.designation ?? null,
            department: input.department ?? null,
            dateOfJoining: input.dateOfJoining ?? new Date().toISOString().split('T')[0],
            employmentType: input.employmentType ?? EmploymentType.REGULAR,
            specialization: input.specialization ?? null,
            createdBy: actorId,
            updatedBy: actorId,
          })
          .returning();
        return rows[0];
      },
    );

    this.emitEvent(EVENT_PATTERNS.STAFF.joined, {
      staffProfileId: profile.id,
      membershipId: newMembership[0].id,
      department: input.department,
      tenantId,
    });

    // Re-fetch via findById so the GraphQL StaffModel response includes the
    // joined name + photo from user_profiles (StaffModel.firstName is now
    // i18nText and required).
    return this.findById(profile.id);
  }

  async update(id: string, input: UpdateStaffInput) {
    const tenantId = this.tenantId;
    const actorId = this.userId;

    const updated = await withTenant(
      this.db,
      mkInstituteCtx(tenantId, 'service:staff'),
      async (tx) => {
        // Check existence first — separate not-found from version mismatch.
        // Read through `staff_profiles_live` so soft-deleted rows are hidden
        // automatically (no explicit `isNull(deletedAt)` predicate needed).
        const existing = await tx
          .select({ id: staffProfilesLive.id })
          .from(staffProfilesLive)
          .where(eq(staffProfilesLive.id, id))
          .limit(1);
        if (existing.length === 0) throw new NotFoundException(`Staff profile ${id} not found`);

        const rows = await tx
          .update(staffProfiles)
          .set({
            ...(input.designation != null && { designation: input.designation }),
            ...(input.department != null && { department: input.department }),
            ...(input.employmentType != null && { employmentType: input.employmentType }),
            ...(input.isClassTeacher != null && { isClassTeacher: input.isClassTeacher }),
            ...(input.specialization != null && { specialization: input.specialization }),
            ...(input.socialCategory != null && { socialCategory: input.socialCategory }),
            updatedBy: actorId,
            version: sql`${staffProfiles.version} + 1`,
          })
          .where(
            and(
              eq(staffProfiles.id, id),
              eq(staffProfiles.version, input.version),
              isNull(staffProfiles.deletedAt),
            ),
          )
          .returning();

        if (rows.length === 0) {
          throw new ConflictException(
            'Staff profile was modified by another request (version mismatch)',
          );
        }
        return rows[0];
      },
    );

    // Re-fetch via findById so the GraphQL response includes the joined
    // name + photo from user_profiles.
    return this.findById(updated.id);
  }

  async delete(id: string) {
    const tenantId = this.tenantId;
    const actorId = this.userId;
    const today = new Date().toISOString().split('T')[0];

    const deleted = await withTenant(
      this.db,
      mkInstituteCtx(tenantId, 'service:staff'),
      async (tx) => {
        const rows = await tx
          .update(staffProfiles)
          .set({
            deletedAt: new Date(),
            deletedBy: actorId,
            dateOfLeaving: today,
          })
          .where(and(eq(staffProfiles.id, id), isNull(staffProfiles.deletedAt)))
          .returning();

        if (rows.length === 0) throw new NotFoundException(`Staff profile ${id} not found`);
        return rows[0];
      },
    );

    this.emitEvent(EVENT_PATTERNS.STAFF.left, {
      staffProfileId: id,
      reason: deleted.leavingReason ?? 'deleted',
      tenantId,
    });

    return true;
  }

  async statistics() {
    const tenantId = this.tenantId;
    return withTenant(this.db, mkInstituteCtx(tenantId, 'service:staff'), async (tx) => {
      const [totalRow] = await tx.select({ count: count() }).from(staffProfilesLive);
      const [classTeacherRow] = await tx
        .select({ count: count() })
        .from(staffProfilesLive)
        .where(eq(staffProfilesLive.isClassTeacher, true));

      const deptRows = await tx
        .select({
          department: staffProfilesLive.department,
          count: count(),
        })
        .from(staffProfilesLive)
        .groupBy(staffProfilesLive.department);

      return {
        total: totalRow.count,
        active: totalRow.count,
        classTeachers: classTeacherRow.count,
        byDepartment: deptRows.map((r) => ({
          department: r.department ?? 'Unassigned',
          count: r.count,
        })),
      };
    });
  }
}
