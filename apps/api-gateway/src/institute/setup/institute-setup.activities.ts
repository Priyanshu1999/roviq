/**
 * Activities for InstituteSetupWorkflow (ROV-126, PRD §10.4).
 *
 * Each activity is idempotent — checks "exists?" before creating.
 * Activities that call Identity Service use NATS stubs (Identity Service
 * handlers are in the Auth & Identity project, not implemented here).
 *
 * Temporal activities must accept only serializable arguments.
 * The DrizzleDB + ClientProxy are injected at worker startup via closure.
 */
import { Logger } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import {
  academicYears,
  academicYearsLive,
  type DrizzleDB,
  instituteConfigs,
  instituteNotificationConfigs,
  institutes,
  mkAdminCtx,
  withAdmin,
} from '@roviq/database';
import { EVENT_PATTERNS } from '@roviq/nats-jetstream';
import { eq } from 'drizzle-orm';
import type { InstituteSetupActivities, InstituteSetupProgress } from './institute-setup.types';

const logger = new Logger('InstituteSetupActivities');

/**
 * Create activity implementations bound to a DrizzleDB instance and NATS client.
 * Called at Temporal worker startup — activities close over the connections.
 */
export function createInstituteSetupActivities(
  db: DrizzleDB,
  natsClient: ClientProxy,
): InstituteSetupActivities {
  return {
    // ── Phase 1: Identity (via NATS stubs) ─────────────────

    /**
     * Request Identity Service to create "Admin" role for this institute.
     * TODO: Replace stub with actual NATS call when Identity Service implements
     * the IDENTITY.createRole handler (Auth & Identity project).
     */
    async createAdminRole(instituteId: string, _creatingUserId: string): Promise<string> {
      logger.log(`[STUB] NATS → IDENTITY.createRole: Admin role for institute ${instituteId}`);
      // TODO: Actual NATS call:
      // const result = await firstValueFrom(
      //   natsClient.send('IDENTITY.createRole', {
      //     tenantId: instituteId,
      //     name: 'Admin',
      //     scope: 'institute',
      //     abilities: [{ action: 'manage', subject: 'all' }],
      //     isSystem: true,
      //     isDefault: true,
      //     headers: { 'x-actor-id': creatingUserId },
      //   })
      // );
      // return result.roleId;
      return `stub-admin-role-${instituteId}`;
    },

    /**
     * Request Identity Service to create admin membership.
     * TODO: Replace stub with actual NATS call to IDENTITY.createMembership.
     */
    async createAdminMembership(
      instituteId: string,
      creatingUserId: string,
      roleId: string,
    ): Promise<string> {
      logger.log(
        `[STUB] NATS → IDENTITY.createMembership: user=${creatingUserId}, role=${roleId}, institute=${instituteId}`,
      );
      // TODO: Actual NATS call to Identity Service.
      // Identity Service creates membership + generates secure random password if new user.
      // Enforces password change on first login.
      return `stub-membership-${instituteId}`;
    },

    /**
     * Request Identity Service to create "System" role for automated operations.
     * TODO: Replace stub with actual NATS call to IDENTITY.createRole.
     */
    async createSystemRole(instituteId: string, _creatingUserId: string): Promise<string> {
      logger.log(`[STUB] NATS → IDENTITY.createRole: System role for institute ${instituteId}`);
      return `stub-system-role-${instituteId}`;
    },

    /** Set admin as institute representative (updates institute record) */
    async setInstituteRepresentative(instituteId: string, _creatingUserId: string): Promise<void> {
      logger.log(`Setting representative for institute ${instituteId}`);
      // Representative field not yet on institutes table — logging only for now
    },

    // ── Phase 2: Infrastructure ────────────────────────────

    /** Create storage bucket (MinIO/S3) for the institute */
    async createStorageBucket(instituteId: string): Promise<void> {
      logger.log(`[STUB] Creating storage bucket for institute ${instituteId}`);
      // TODO: Call MinIO client to create bucket named `institute-${instituteId}`
    },

    /**
     * Create wallets via Finance Service NATS call.
     * TODO: Replace stub when Finance Service is built.
     */
    async createWallets(instituteId: string): Promise<void> {
      logger.log(
        `[STUB] NATS → FINANCE.createWallets: fund, virtual, cash, expense for ${instituteId}`,
      );
      // TODO: Actual NATS call to Finance Service
    },

    /**
     * Request Identity Service to create default roles (teacher, student, parent, etc.).
     * TODO: Replace stub with actual NATS call to IDENTITY.createDefaultRoles.
     */
    async createDefaultRoles(instituteId: string, _creatingUserId: string): Promise<void> {
      logger.log(
        `[STUB] NATS → IDENTITY.createDefaultRoles: teacher, student, parent for ${instituteId}`,
      );
      // TODO: Actual NATS call — Identity Service creates roles from DEFAULT_ROLE_ABILITIES
    },

    // ── Phase 3: Academic Structure ────────────────────────

    /**
     * Seed standards, sections, and subjects for the institute.
     * Delegates to InstituteSeederService (injected via closure).
     * Idempotent — seeder checks existence before creating.
     *
     * NOTE: Temporal activities can't access NestJS DI directly.
     * The seeder is passed via closure at worker startup, or this activity
     * uses direct DB operations mirroring the seeder logic.
     */
    async seedAcademicStructure(
      instituteId: string,
      _academicYearId: string,
      departments: string[],
      _board: string | undefined,
      type: string,
      _creatingUserId: string,
    ): Promise<{ standardsCreated: number; sectionsCreated: number; subjectsSeeded: number }> {
      logger.log(
        `Seeding academic structure: institute=${instituteId}, type=${type}, departments=${departments.join(',')}`,
      );

      // Academic structure seeding is handled by InstituteSetupService (NestJS service)
      // which calls InstituteSeederService with proper DI context.
      // This Temporal activity logs the intent — the actual seeding runs in the
      // NestJS process via the existing InstituteSetupService.runSetup() method.
      // When migrating fully to Temporal, the seeder will be injected via closure
      // at worker startup (same pattern as createPartitionActivities in audit).
      logger.log(
        `Academic structure seeding for ${instituteId}: type=${type}, ` +
          `departments=[${departments.join(',')}] — delegated to InstituteSeederService`,
      );

      // Return zeroes — actual counts come from the NestJS seeder
      return { standardsCreated: 0, sectionsCreated: 0, subjectsSeeded: 0 };
    },

    // ── Phase 4: Configuration ─────────────────────────────

    /** Generate default notification config for the institute */
    async createDefaultNotificationConfig(
      instituteId: string,
      creatingUserId: string,
    ): Promise<void> {
      logger.log(`Creating default notification config for ${instituteId}`);

      const notificationTypes = ['FEE', 'ATTENDANCE', 'APPROVAL'];

      await withAdmin(db, mkAdminCtx('seeder:institute-setup.activities'), async (tx) => {
        for (const notificationType of notificationTypes) {
          // Idempotency: ON CONFLICT DO NOTHING
          await tx
            .insert(instituteNotificationConfigs)
            .values({
              tenantId: instituteId,
              notificationType,
              inAppEnabled: true,
              whatsappEnabled: false,
              emailEnabled: true,
              pushEnabled: false,
              digestEnabled: false,
              createdBy: creatingUserId,
              updatedBy: creatingUserId,
            })
            .onConflictDoNothing();
        }
      });
    },

    /** Create institute config with board-specific section_strength_norms */
    async createInstituteConfig(
      instituteId: string,
      board: string | undefined,
      creatingUserId: string,
    ): Promise<void> {
      logger.log(`Creating institute config for ${instituteId} (board=${board ?? 'none'})`);

      // Board-specific section strength norms (PRD §7.3)
      const normsByBoard: Record<
        string,
        { optimal: number; hardMax: number; exemptionAllowed: boolean }
      > = {
        CBSE: { optimal: 40, hardMax: 45, exemptionAllowed: true },
        BSEH: { optimal: 40, hardMax: 45, exemptionAllowed: true },
        RBSE: { optimal: 40, hardMax: 45, exemptionAllowed: true },
        ICSE: { optimal: 35, hardMax: 40, exemptionAllowed: false },
      };

      const sectionStrengthNorms = board
        ? (normsByBoard[board] ?? normsByBoard.CBSE)
        : normsByBoard.CBSE;

      await withAdmin(db, mkAdminCtx('seeder:institute-setup.activities'), async (tx) => {
        await tx
          .insert(instituteConfigs)
          .values({
            tenantId: instituteId,
            sectionStrengthNorms,
            createdBy: creatingUserId,
            updatedBy: creatingUserId,
          })
          .onConflictDoNothing();
      });
    },

    // TODO (ROV-152): Seed default tenant_sequences for this institute:
    //   - `adm_no`       → format from institute_configs.admission_number_config
    //   - `enquiry_no`   → format `ENQ-{year}/{value:04d}`
    //   - `tc_no:{year}` → format `TC/{year}/{value:03d}`
    // See: libs/database/src/schema/sequences/tenant-sequences.ts

    /** Create first academic year in active state (Indian: April–March) */
    async createFirstAcademicYear(instituteId: string, creatingUserId: string): Promise<string> {
      const now = new Date();
      // Indian academic year: April to March
      const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      const label = `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
      const startDate = `${startYear}-04-01`;
      const endDate = `${startYear + 1}-03-31`;

      return withAdmin(db, mkAdminCtx('seeder:institute-setup.activities'), async (tx) => {
        // Idempotency: check if academic year already exists
        const existing = await tx
          .select({ id: academicYearsLive.id })
          .from(academicYearsLive)
          .where(eq(academicYearsLive.tenantId, instituteId));

        if (existing.length > 0) {
          logger.log(`Academic year already exists for ${instituteId}, skipping`);
          return existing[0].id;
        }

        const rows = await tx
          .insert(academicYears)
          .values({
            tenantId: instituteId,
            label,
            startDate,
            endDate,
            isActive: true,
            status: 'ACTIVE',
            createdBy: creatingUserId,
            updatedBy: creatingUserId,
          })
          .returning({ id: academicYears.id });

        logger.log(`Created academic year "${label}" for ${instituteId}`);
        return rows[0].id;
      });
    },

    // ── Phase 5: Demo Data ─────────────────────────────────

    /** Seed demo data — only runs when isDemo=true. Notifications disabled for demo. */
    async seedDemoData(instituteId: string, _creatingUserId: string): Promise<void> {
      logger.log(`[STUB] Seeding demo data for institute ${instituteId}`);
      // TODO: Generate sample students, attendance records, etc.
      // Demo institutes have all notification channels disabled

      // Disable all notification channels for demo institutes
      await withAdmin(db, mkAdminCtx('seeder:institute-setup.activities'), async (tx) => {
        await tx
          .update(instituteNotificationConfigs)
          .set({
            inAppEnabled: false,
            whatsappEnabled: false,
            emailEnabled: false,
            pushEnabled: false,
          })
          .where(eq(instituteNotificationConfigs.tenantId, instituteId));
      });

      logger.log(`Demo data seeded + notifications disabled for ${instituteId}`);
    },

    // ── Completion ─────────────────────────────────────────

    /** Update institute setup_status */
    async updateSetupStatus(
      instituteId: string,
      status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED',
      creatingUserId: string,
    ): Promise<void> {
      await withAdmin(db, mkAdminCtx('seeder:institute-setup.activities'), async (tx) => {
        await tx
          .update(institutes)
          .set({
            setupStatus: status,
            updatedBy: creatingUserId,
          })
          .where(eq(institutes.id, instituteId));
      });

      if (status === 'COMPLETED') {
        natsClient
          .emit(EVENT_PATTERNS.INSTITUTE.setup_completed, { instituteId, tenantId: instituteId })
          .subscribe({
            error: (err: unknown) =>
              logger.warn(`Failed to emit INSTITUTE.setup_completed: ${err}`),
          });
      }

      logger.log(`Setup status → ${status} for institute ${instituteId}`);
    },

    /** Publish progress update via NATS for instituteSetupProgress subscription */
    async publishProgress(progress: InstituteSetupProgress): Promise<void> {
      natsClient
        .emit(EVENT_PATTERNS.INSTITUTE.setup_progress, {
          ...progress,
          tenantId: progress.instituteId,
        })
        .subscribe({
          error: (err: unknown) => logger.warn(`Failed to publish setup progress: ${err}`),
        });
    },
  };
}
