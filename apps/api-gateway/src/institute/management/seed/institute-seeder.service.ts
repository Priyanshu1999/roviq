import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  DRIZZLE_DB,
  type DrizzleDB,
  sections,
  standardSubjects,
  standards,
  subjects,
  withTenant,
} from '@roviq/database';
import { getRequestContext } from '@roviq/request-context';
import { and, eq, sql } from 'drizzle-orm';
import {
  BOARD_EXAM_CLASSES,
  BOARD_SUBJECTS,
  DEFAULT_SECTION_NAMES,
  DEFAULT_SECTIONS_PER_STANDARD,
  DEPARTMENT_STANDARDS,
  LIBRARY_SECTIONS,
  LIBRARY_STANDARD,
} from './board-templates';

@Injectable()
export class InstituteSeederService {
  private readonly logger = new Logger(InstituteSeederService.name);

  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {}

  /**
   * Seed standards for selected departments using board-appropriate templates.
   * Idempotent: checks existence before creating.
   */
  async seedStandards(
    tenantId: string,
    academicYearId: string,
    departments: string[],
    board?: string,
  ): Promise<string[]> {
    const { userId } = getRequestContext();
    const createdIds: string[] = [];

    await withTenant(this.db, tenantId, async (tx) => {
      for (const dept of departments) {
        const templates = DEPARTMENT_STANDARDS[dept];
        if (!templates) {
          this.logger.warn(`Unknown department: ${dept}, skipping`);
          continue;
        }

        for (const tmpl of templates) {
          // Idempotency: check if standard already exists
          const existing = await tx
            .select({ id: standards.id })
            .from(standards)
            .where(
              and(
                eq(standards.academicYearId, academicYearId),
                eq(standards.numericOrder, tmpl.numericOrder),
              ),
            );

          if (existing.length > 0) {
            createdIds.push(existing[0].id);
            continue;
          }

          const isBoardExam = board
            ? (BOARD_EXAM_CLASSES[board] ?? []).includes(tmpl.numericOrder)
            : tmpl.isBoardExamClass;

          const rows = await tx
            .insert(standards)
            .values({
              tenantId,
              academicYearId,
              name: { en: tmpl.name },
              numericOrder: tmpl.numericOrder,
              level: tmpl.level as (typeof standards.level.enumValues)[number],
              nepStage: tmpl.nepStage as (typeof standards.nepStage.enumValues)[number],
              department: tmpl.department,
              isBoardExamClass: isBoardExam,
              streamApplicable: tmpl.streamApplicable,
              udiseClassCode: tmpl.udiseClassCode,
              maxStudentsPerSection: 40,
              createdBy: userId,
              updatedBy: userId,
            })
            .returning({ id: standards.id });

          createdIds.push(rows[0].id);
        }
      }
    });

    this.logger.log(`Seeded ${createdIds.length} standards for ${departments.join(', ')}`);
    return createdIds;
  }

  /**
   * Seed default sections for a standard.
   * Idempotent: checks existence before creating.
   */
  async seedSections(
    tenantId: string,
    standardId: string,
    academicYearId: string,
    count = DEFAULT_SECTIONS_PER_STANDARD,
    names = DEFAULT_SECTION_NAMES,
  ): Promise<string[]> {
    const { userId } = getRequestContext();
    const createdIds: string[] = [];

    await withTenant(this.db, tenantId, async (tx) => {
      for (let i = 0; i < count; i++) {
        const name = names[i] ?? String.fromCodePoint(65 + i); // A, B, C, D...

        const existing = await tx
          .select({ id: sections.id })
          .from(sections)
          .where(and(eq(sections.standardId, standardId), sql`${sections.name}->>'en' = ${name}`));

        if (existing.length > 0) {
          createdIds.push(existing[0].id);
          continue;
        }

        const rows = await tx
          .insert(sections)
          .values({
            tenantId,
            standardId,
            academicYearId,
            name: { en: name },
            displayOrder: i,
            genderRestriction: 'CO_ED',
            capacity: 40,
            currentStrength: 0,
            createdBy: userId,
            updatedBy: userId,
          })
          .returning({ id: sections.id });

        createdIds.push(rows[0].id);
      }
    });

    return createdIds;
  }

  /**
   * Seed subjects for a board and link them to standards.
   * Idempotent: checks existence before creating.
   */
  async seedSubjects(tenantId: string, academicYearId: string, board: string): Promise<string[]> {
    const { userId } = getRequestContext();
    const templates = BOARD_SUBJECTS[board];
    if (!templates) {
      this.logger.warn(`No subject templates for board: ${board}`);
      return [];
    }

    const createdIds: string[] = [];

    await withTenant(this.db, tenantId, async (tx) => {
      // Load all standards for this academic year to map numericOrder → id
      const allStandards = await tx
        .select({ id: standards.id, numericOrder: standards.numericOrder })
        .from(standards)
        .where(eq(standards.academicYearId, academicYearId));

      const orderToId = new Map(allStandards.map((s) => [s.numericOrder, s.id]));

      for (const tmpl of templates) {
        // Idempotency: check by name + boardCode
        const existing = await tx
          .select({ id: subjects.id })
          .from(subjects)
          .where(
            and(
              eq(subjects.name, tmpl.name),
              tmpl.boardCode
                ? eq(subjects.boardCode, tmpl.boardCode)
                : eq(subjects.name, tmpl.name),
            ),
          );

        let subjectId: string;

        if (existing.length > 0) {
          subjectId = existing[0].id;
        } else {
          const rows = await tx
            .insert(subjects)
            .values({
              tenantId,
              name: tmpl.name,
              shortName: tmpl.shortName,
              boardCode: tmpl.boardCode,
              type: tmpl.type as (typeof subjects.type.enumValues)[number],
              isMandatory: tmpl.isMandatory,
              hasPractical: tmpl.hasPractical,
              theoryMarks: tmpl.theoryMarks,
              practicalMarks: tmpl.practicalMarks,
              internalMarks: tmpl.internalMarks,
              isElective: false,
              createdBy: userId,
              updatedBy: userId,
            })
            .returning({ id: subjects.id });

          subjectId = rows[0].id;
        }

        createdIds.push(subjectId);

        // Link to applicable standards
        for (const classNum of tmpl.applicableClasses) {
          const standardId = orderToId.get(classNum);
          if (!standardId) continue;

          await tx
            .insert(standardSubjects)
            .values({
              tenantId,
              subjectId,
              standardId,
              createdBy: userId,
              updatedBy: userId,
            })
            .onConflictDoNothing();
        }
      }
    });

    this.logger.log(`Seeded ${createdIds.length} subjects for board ${board}`);
    return createdIds;
  }

  /**
   * Seed library structure: single standard + 2 sections.
   */
  async seedLibrary(tenantId: string, academicYearId: string): Promise<void> {
    const _standardIds = await this.seedStandards(tenantId, academicYearId, [], undefined);

    // Create the Library standard manually since it's not in departments
    const { userId } = getRequestContext();
    let libraryStandardId = '';

    await withTenant(this.db, tenantId, async (tx) => {
      const existing = await tx
        .select({ id: standards.id })
        .from(standards)
        .where(
          and(
            eq(standards.academicYearId, academicYearId),
            sql`${standards.name}->>'en' = ${LIBRARY_STANDARD.name}`,
          ),
        );

      if (existing.length > 0) {
        libraryStandardId = existing[0].id;
      } else {
        const rows = await tx
          .insert(standards)
          .values({
            tenantId,
            academicYearId,
            name: { en: LIBRARY_STANDARD.name },
            numericOrder: LIBRARY_STANDARD.numericOrder,
            createdBy: userId,
            updatedBy: userId,
          })
          .returning({ id: standards.id });
        libraryStandardId = rows[0].id;
      }
    });

    await this.seedSections(tenantId, libraryStandardId, academicYearId, 2, LIBRARY_SECTIONS);
    this.logger.log('Seeded library structure');
  }
}
