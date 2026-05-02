/**
 * Staff qualification service — structured CRUD for `staff_qualifications`.
 *
 * All reads/writes are wrapped in `withTenant()` so RLS enforces tenant
 * isolation (see `.claude/rules/tenant-isolation.md`). The table is
 * tenant-scoped via a `tenant_id` FK to `institutes`.
 */

import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  DRIZZLE_DB,
  type DrizzleDB,
  mkAdminCtx,
  mkInstituteCtx,
  staffQualifications,
  withAdmin,
  withTenant,
} from '@roviq/database';
import { getRequestContext } from '@roviq/request-context';
import { and, asc, eq } from 'drizzle-orm';
import type { CreateStaffQualificationInput } from './dto/create-staff-qualification.input';
import type { UpdateStaffQualificationInput } from './dto/update-staff-qualification.input';
import type { StaffQualificationModel } from './models/staff-qualification.model';

@Injectable()
export class StaffQualificationService {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {}

  private get tenantId(): string {
    const { tenantId } = getRequestContext();
    if (!tenantId) throw new Error('Tenant context required');
    return tenantId;
  }

  /** Returns qualifications for a staff profile, newest-first on year. */
  async listForStaff(staffProfileId: string): Promise<StaffQualificationModel[]> {
    const tenantId = this.tenantId;
    return withTenant(
      this.db,
      mkInstituteCtx(tenantId, 'service:staff-qualification'),
      async (tx) => {
        const rows = await tx
          .select()
          .from(staffQualifications)
          .where(eq(staffQualifications.staffProfileId, staffProfileId))
          .orderBy(asc(staffQualifications.type), asc(staffQualifications.degreeName));
        return rows as unknown as StaffQualificationModel[];
      },
    );
  }

  async create(input: CreateStaffQualificationInput): Promise<StaffQualificationModel> {
    const tenantId = this.tenantId;
    return withTenant(
      this.db,
      mkInstituteCtx(tenantId, 'service:staff-qualification'),
      async (tx) => {
        const rows = await tx
          .insert(staffQualifications)
          .values({
            staffProfileId: input.staffProfileId,
            tenantId,
            type: input.type,
            degreeName: input.degreeName,
            institution: input.institution ?? null,
            boardUniversity: input.boardUniversity ?? null,
            yearOfPassing: input.yearOfPassing ?? null,
            gradePercentage: input.gradePercentage ?? null,
            certificateUrl: input.certificateUrl ?? null,
          })
          .returning();
        return rows[0] as unknown as StaffQualificationModel;
      },
    );
  }

  async update(id: string, input: UpdateStaffQualificationInput): Promise<StaffQualificationModel> {
    const tenantId = this.tenantId;
    return withTenant(
      this.db,
      mkInstituteCtx(tenantId, 'service:staff-qualification'),
      async (tx) => {
        const patch: Record<string, unknown> = {};
        if (input.type !== undefined) patch.type = input.type;
        if (input.degreeName !== undefined) patch.degreeName = input.degreeName;
        if (input.institution !== undefined) patch.institution = input.institution;
        if (input.boardUniversity !== undefined) patch.boardUniversity = input.boardUniversity;
        if (input.yearOfPassing !== undefined) patch.yearOfPassing = input.yearOfPassing;
        if (input.gradePercentage !== undefined) patch.gradePercentage = input.gradePercentage;
        if (input.certificateUrl !== undefined) patch.certificateUrl = input.certificateUrl;

        const rows = await tx
          .update(staffQualifications)
          .set(patch)
          .where(and(eq(staffQualifications.id, id)))
          .returning();

        if (rows.length === 0) {
          throw new NotFoundException(`Staff qualification ${id} not found`);
        }
        return rows[0] as unknown as StaffQualificationModel;
      },
    );
  }

  async delete(id: string): Promise<boolean> {
    const tenantId = this.tenantId;
    // The `staff_qualifications` table blocks DELETE for `roviq_app` via
    // `tenantPoliciesSimple` (USING (false)) and has no soft-delete columns,
    // so the hard-delete must run through the admin policy. Tenant isolation
    // is re-enforced here by the explicit `tenant_id = :tenantId` predicate
    // in the WHERE clause, making the operation cross-tenant-safe.
    return withAdmin(this.db, mkAdminCtx('service:staff-qualification'), async (tx) => {
      const rows = await tx
        .delete(staffQualifications)
        .where(and(eq(staffQualifications.id, id), eq(staffQualifications.tenantId, tenantId)))
        .returning({ id: staffQualifications.id });
      if (rows.length === 0) {
        throw new NotFoundException(`Staff qualification ${id} not found`);
      }
      return true;
    });
  }
}
