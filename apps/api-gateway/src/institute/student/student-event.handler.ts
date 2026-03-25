/**
 * NATS event consumers for the student module (ROV-154).
 *
 * Listens for domain events that affect student data:
 * - academic_year.activated → create student_academics rows for continuing students
 * - section.deleted → soft-delete affected student_academics (sectionId is NOT NULL)
 */
import { Controller, Inject, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import {
  DRIZZLE_DB,
  type DrizzleDB,
  sections,
  studentAcademics,
  studentProfiles,
  withTenant,
} from '@roviq/database';
import { and, eq, sql } from 'drizzle-orm';

@Controller()
export class StudentEventHandler {
  private readonly logger = new Logger(StudentEventHandler.name);

  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {}

  /**
   * When a new academic year is activated, create student_academics rows
   * for all continuing students (enrolled/promoted in the previous year).
   *
   * Copies from the previous year's enrollment, keeping the same standard
   * (or promoted standard if promotion_status = 'promoted').
   */
  @EventPattern('ACADEMIC_YEAR.activated')
  async onAcademicYearActivated(
    @Payload()
    data: { tenantId: string; academicYearId: string; previousAcademicYearId?: string },
  ): Promise<void> {
    const { tenantId, academicYearId, previousAcademicYearId } = data;

    if (!previousAcademicYearId) {
      this.logger.log('No previous academic year — skipping student rollover');
      return;
    }

    this.logger.log(
      `Rolling over students from year ${previousAcademicYearId} to ${academicYearId}`,
    );

    await withTenant(this.db, tenantId, async (tx) => {
      const previousEnrollments = await tx
        .select({
          studentProfileId: studentAcademics.studentProfileId,
          standardId: studentAcademics.standardId,
          sectionId: studentAcademics.sectionId,
          promotionStatus: studentAcademics.promotionStatus,
          promotedToStandardId: studentAcademics.promotedToStandardId,
          tenantId: studentAcademics.tenantId,
          createdBy: studentAcademics.createdBy,
        })
        .from(studentAcademics)
        .innerJoin(studentProfiles, eq(studentProfiles.id, studentAcademics.studentProfileId))
        .where(
          and(
            eq(studentAcademics.academicYearId, previousAcademicYearId),
            sql`${studentProfiles.academicStatus} IN ('enrolled', 'promoted', 'detained', 're_enrolled')`,
          ),
        );

      let created = 0;
      for (const prev of previousEnrollments) {
        const targetStandardId =
          prev.promotionStatus === 'promoted' && prev.promotedToStandardId
            ? prev.promotedToStandardId
            : prev.standardId;

        const targetSections = await tx
          .select({ id: sections.id })
          .from(sections)
          .where(
            and(
              eq(sections.standardId, targetStandardId),
              eq(sections.academicYearId, academicYearId),
            ),
          )
          .limit(1);

        if (targetSections.length === 0) {
          this.logger.warn(
            `No section found for standard ${targetStandardId} in year ${academicYearId} — skipping student ${prev.studentProfileId}`,
          );
          continue;
        }

        try {
          await tx
            .insert(studentAcademics)
            .values({
              studentProfileId: prev.studentProfileId,
              academicYearId,
              standardId: targetStandardId,
              sectionId: targetSections[0].id,
              tenantId: prev.tenantId,
              createdBy: prev.createdBy,
              updatedBy: prev.createdBy,
            })
            .onConflictDoNothing();
          created++;
        } catch (error) {
          this.logger.warn(
            `Failed to create enrollment for student ${prev.studentProfileId}: ${error}`,
          );
        }
      }

      this.logger.log(
        `Student rollover complete: ${created} enrollments created from ${previousEnrollments.length} previous`,
      );
    });
  }

  /**
   * When a section is deleted, soft-delete affected student_academics rows.
   *
   * Cannot null out section_id because the column is NOT NULL.
   * Soft-deleted rows are invisible to normal queries (RLS filters deleted_at IS NULL).
   * Students need manual reassignment to a new section.
   */
  @EventPattern('SECTION.deleted')
  async onSectionDeleted(@Payload() data: { sectionId: string; tenantId: string }): Promise<void> {
    const { sectionId, tenantId } = data;

    this.logger.warn(`Section ${sectionId} deleted — soft-deleting affected student_academics`);

    await withTenant(this.db, tenantId, async (tx) => {
      const affected = await tx
        .update(studentAcademics)
        .set({
          deletedAt: new Date(),
          updatedBy: 'SYSTEM',
        })
        .where(
          and(
            eq(studentAcademics.sectionId, sectionId),
            sql`${studentAcademics.deletedAt} IS NULL`,
          ),
        )
        .returning({ id: studentAcademics.id });

      this.logger.warn(
        `Soft-deleted ${affected.length} student_academics rows for section ${sectionId}`,
      );
    });
  }
}
