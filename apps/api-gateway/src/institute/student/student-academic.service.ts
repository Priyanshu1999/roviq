/**
 * Student enrollment + section change service (ROV-154).
 *
 * Handles capacity checks (warn at optimal, hard-block at hard_max),
 * section strength updates, and NATS event emission.
 */
import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { getRequestContext } from '@roviq/common-types';
import {
  DRIZZLE_DB,
  type DrizzleDB,
  instituteConfigs,
  type SectionStrengthNorms,
  sections,
  studentAcademics,
  withTenant,
} from '@roviq/database';
import { eq, sql } from 'drizzle-orm';
import { EventBusService } from '../../common/event-bus.service';
import type { EnrollStudentInput, UpdateStudentSectionInput } from './dto/enroll-student.input';

@Injectable()
export class StudentAcademicService {
  private readonly logger = new Logger(StudentAcademicService.name);

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

  // ── ENROLL ────────────────────────────────────────────────

  async enroll(input: EnrollStudentInput): Promise<{ id: string }> {
    const tenantId = this.getTenantId();
    const actorId = this.getUserId();

    // Get section and capacity norms
    const { section, norms } = await this.getSectionWithNorms(tenantId, input.sectionId);

    // Capacity check
    this.checkCapacity(section.currentStrength, norms, input.overrideReason);

    // Create student_academics row
    const result = await withTenant(this.db, tenantId, async (tx) => {
      const rows = await tx
        .insert(studentAcademics)
        .values({
          studentProfileId: input.studentProfileId,
          academicYearId: input.academicYearId,
          standardId: input.standardId,
          sectionId: input.sectionId,
          tenantId,
          createdBy: actorId,
          updatedBy: actorId,
        })
        .returning({ id: studentAcademics.id });

      // Increment section strength
      await tx
        .update(sections)
        .set({ currentStrength: sql`${sections.currentStrength} + 1` })
        .where(eq(sections.id, input.sectionId));

      return rows[0];
    });

    // Emit warning if at optimal capacity
    if (section.currentStrength + 1 >= norms.optimal) {
      this.eventBus.emit('SECTION.capacity_warning', {
        sectionId: input.sectionId,
        currentStrength: section.currentStrength + 1,
        optimal: norms.optimal,
        tenantId,
      });
    }

    this.eventBus.emit('STUDENT.enrolled', {
      studentProfileId: input.studentProfileId,
      academicYearId: input.academicYearId,
      sectionId: input.sectionId,
      tenantId,
    });

    this.logger.log(`Student ${input.studentProfileId} enrolled in section ${input.sectionId}`);
    return result;
  }

  // ── SECTION CHANGE ────────────────────────────────────────

  async changeSection(input: UpdateStudentSectionInput): Promise<{ id: string }> {
    const tenantId = this.getTenantId();
    const actorId = this.getUserId();

    // Get current enrollment
    const current = await withTenant(this.db, tenantId, async (tx) => {
      return tx
        .select({
          id: studentAcademics.id,
          sectionId: studentAcademics.sectionId,
          studentProfileId: studentAcademics.studentProfileId,
        })
        .from(studentAcademics)
        .where(eq(studentAcademics.id, input.studentAcademicId))
        .limit(1);
    });

    if (current.length === 0) {
      throw new NotFoundException('Student academic record not found');
    }

    const oldSectionId = current[0].sectionId;

    // Capacity check on target section
    const { section: targetSection, norms } = await this.getSectionWithNorms(
      tenantId,
      input.newSectionId,
    );
    this.checkCapacity(targetSection.currentStrength, norms, input.overrideReason);

    // Update section + adjust strengths
    await withTenant(this.db, tenantId, async (tx) => {
      await tx
        .update(studentAcademics)
        .set({ sectionId: input.newSectionId, updatedBy: actorId })
        .where(eq(studentAcademics.id, input.studentAcademicId));

      // Decrement old section
      await tx
        .update(sections)
        .set({ currentStrength: sql`GREATEST(${sections.currentStrength} - 1, 0)` })
        .where(eq(sections.id, oldSectionId));

      // Increment new section
      await tx
        .update(sections)
        .set({ currentStrength: sql`${sections.currentStrength} + 1` })
        .where(eq(sections.id, input.newSectionId));
    });

    this.eventBus.emit('STUDENT.section_changed', {
      studentProfileId: current[0].studentProfileId,
      oldSectionId,
      newSectionId: input.newSectionId,
      tenantId,
    });

    this.logger.log(
      `Student section changed: ${current[0].studentProfileId} from ${oldSectionId} to ${input.newSectionId}`,
    );

    return { id: current[0].id };
  }

  // ── PRIVATE HELPERS ───────────────────────────────────────

  private async getSectionWithNorms(
    tenantId: string,
    sectionId: string,
  ): Promise<{
    section: { currentStrength: number; capacity: number | null };
    norms: SectionStrengthNorms;
  }> {
    const sectionRows = await withTenant(this.db, tenantId, async (tx) => {
      return tx
        .select({
          currentStrength: sections.currentStrength,
          capacity: sections.capacity,
        })
        .from(sections)
        .where(eq(sections.id, sectionId))
        .limit(1);
    });

    if (sectionRows.length === 0) {
      throw new NotFoundException('Section not found');
    }

    const configRows = await withTenant(this.db, tenantId, async (tx) => {
      return tx
        .select({ sectionStrengthNorms: instituteConfigs.sectionStrengthNorms })
        .from(instituteConfigs)
        .limit(1);
    });

    const norms: SectionStrengthNorms = configRows[0]?.sectionStrengthNorms ?? {
      optimal: 40,
      hardMax: 45,
      exemptionAllowed: true,
    };

    return { section: sectionRows[0], norms };
  }

  private checkCapacity(
    currentStrength: number,
    norms: SectionStrengthNorms,
    overrideReason?: string,
  ): void {
    if (currentStrength >= norms.hardMax) {
      if (!overrideReason) {
        throw new UnprocessableEntityException({
          message: `Section at hard maximum capacity (${currentStrength}/${norms.hardMax}). Provide override_reason to proceed.`,
          code: 'SECTION_CAPACITY_EXCEEDED',
        });
      }
      this.logger.warn(
        `Capacity override: ${currentStrength}/${norms.hardMax}. Reason: ${overrideReason}`,
      );
    }
  }
}
