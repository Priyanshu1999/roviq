import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  academicYears,
  academicYearsLive,
  DRIZZLE_DB,
  type DrizzleDB,
  institutes,
  withAdmin,
} from '@roviq/database';
import { getRequestContext } from '@roviq/request-context';
import { eq } from 'drizzle-orm';
import { InstituteSeederService } from './institute-seeder.service';

export interface SetupInput {
  instituteId: string;
  type: string;
  departments: string[];
  board?: string;
  isDemo?: boolean;
}

/**
 * Orchestrates the institute setup pipeline.
 * Currently runs synchronously — designed to be migrated to Temporal workflow later.
 * Each phase is idempotent and can be retried independently.
 */
@Injectable()
export class InstituteSetupService {
  private readonly logger = new Logger(InstituteSetupService.name);

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDB,
    private readonly seeder: InstituteSeederService,
  ) {}

  async runSetup(input: SetupInput): Promise<void> {
    const { instituteId, type, departments, board } = input;
    this.logger.log(`Starting setup for institute ${instituteId} (type=${type})`);

    try {
      await this.updateSetupStatus(instituteId, 'IN_PROGRESS');

      // Phase 1: Create first academic year
      const academicYearId = await this.createFirstAcademicYear(instituteId);

      // Phase 2: Seed academic structure based on institute type
      if (type === 'LIBRARY') {
        await this.seeder.seedLibrary(instituteId, academicYearId);
      } else if (type === 'SCHOOL') {
        // Phase 2a: Seed standards
        await this.seeder.seedStandards(instituteId, academicYearId, departments, board);

        // Phase 2b: Seed sections for each standard
        const _allStandards = await withAdmin(this.db, async (tx) => {
          return tx
            .select({ id: academicYearsLive.id })
            .from(academicYearsLive)
            .where(eq(academicYearsLive.id, academicYearId));
        });

        // Get standard IDs via seeder (it returns them)
        const standardIds = await this.seeder.seedStandards(
          instituteId,
          academicYearId,
          departments,
          board,
        );
        for (const standardId of standardIds) {
          await this.seeder.seedSections(instituteId, standardId, academicYearId);
        }

        // Phase 2c: Seed subjects
        if (board) {
          await this.seeder.seedSubjects(instituteId, academicYearId, board);
        }
      }
      // Coaching: no auto-seeding (admin creates courses manually)

      await this.updateSetupStatus(instituteId, 'COMPLETED');
      this.logger.log(`Setup completed for institute ${instituteId}`);
    } catch (error) {
      this.logger.error(`Setup failed for institute ${instituteId}`, error);
      await this.updateSetupStatus(instituteId, 'FAILED');
      throw error;
    }
  }

  private async updateSetupStatus(
    instituteId: string,
    status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED',
  ): Promise<void> {
    const { userId } = getRequestContext();
    await withAdmin(this.db, async (tx) => {
      await tx
        .update(institutes)
        .set({
          setupStatus: status,
          updatedBy: userId,
        })
        .where(eq(institutes.id, instituteId));
    });
  }

  private async createFirstAcademicYear(instituteId: string): Promise<string> {
    const { userId } = getRequestContext();
    const now = new Date();
    // Indian academic year: April to March
    const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    const label = `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
    const startDate = `${startYear}-04-01`;
    const endDate = `${startYear + 1}-03-31`;

    return withAdmin(this.db, async (tx) => {
      // Idempotency check
      const existing = await tx
        .select({ id: academicYearsLive.id })
        .from(academicYearsLive)
        .where(eq(academicYearsLive.tenantId, instituteId));

      if (existing.length > 0) return existing[0].id;

      const rows = await tx
        .insert(academicYears)
        .values({
          tenantId: instituteId,
          label,
          startDate,
          endDate,
          isActive: true,
          status: 'ACTIVE',
          createdBy: userId,
          updatedBy: userId,
        })
        .returning({ id: academicYears.id });

      return rows[0].id;
    });
  }
}
