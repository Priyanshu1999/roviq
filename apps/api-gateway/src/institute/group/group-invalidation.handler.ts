/**
 * NATS cache invalidation consumer for groups (ROV-163).
 *
 * Listens for domain events and invalidates affected groups by setting
 * resolved_at = NULL (lazy invalidation — next resolveGroupMembers re-evaluates).
 */
import { Controller, Inject, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { GroupMembershipType } from '@roviq/common-types';
import {
  DRIZZLE_DB,
  type DrizzleDB,
  groupRules,
  groups,
  mkInstituteCtx,
  withTenant,
} from '@roviq/database';
import { eq, inArray, sql } from 'drizzle-orm';

@Controller()
export class GroupInvalidationHandler {
  private readonly logger = new Logger(GroupInvalidationHandler.name);

  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {}

  /**
   * student.enrolled → invalidate groups with 'standard_id' or 'section_id' in rule_dimensions
   */
  @EventPattern('STUDENT.enrolled')
  async onStudentEnrolled(@Payload() data: { tenantId: string }): Promise<void> {
    await this.invalidateByDimensions(data.tenantId, ['standard_id', 'section_id']);
  }

  /**
   * student.section_changed → invalidate groups with 'section_id' in rule_dimensions
   */
  @EventPattern('STUDENT.section_changed')
  async onStudentSectionChanged(@Payload() data: { tenantId: string }): Promise<void> {
    await this.invalidateByDimensions(data.tenantId, ['section_id']);
  }

  /**
   * student.promoted → invalidate groups with 'standard_id' in rule_dimensions
   */
  @EventPattern('STUDENT.promoted')
  async onStudentPromoted(@Payload() data: { tenantId: string }): Promise<void> {
    await this.invalidateByDimensions(data.tenantId, ['standard_id']);
  }

  /**
   * student.left → invalidate ALL dynamic groups (student removed from pool)
   */
  @EventPattern('STUDENT.left')
  async onStudentLeft(@Payload() data: { tenantId: string }): Promise<void> {
    await this.invalidateAllDynamic(data.tenantId);
  }

  /**
   * academic_year.activated → invalidate ALL dynamic groups (full refresh needed)
   */
  @EventPattern('ACADEMIC_YEAR.activated')
  async onAcademicYearActivated(@Payload() data: { tenantId: string }): Promise<void> {
    await this.invalidateAllDynamic(data.tenantId);
  }

  /**
   * section.deleted → invalidate groups with 'section_id' in rule_dimensions
   */
  @EventPattern('SECTION.deleted')
  async onSectionDeleted(@Payload() data: { tenantId: string }): Promise<void> {
    await this.invalidateByDimensions(data.tenantId, ['section_id']);
  }

  /**
   * group.rules_updated → invalidate that specific group only
   */
  @EventPattern('GROUP.rules_updated')
  async onGroupRulesUpdated(@Payload() data: { groupId: string; tenantId: string }): Promise<void> {
    await withTenant(this.db, mkInstituteCtx(data.tenantId), async (tx) => {
      await tx.update(groups).set({ resolvedAt: null }).where(eq(groups.id, data.groupId));
    });
    this.logger.log(`Invalidated group ${data.groupId} (rules updated)`);
  }

  // ── PRIVATE HELPERS ───────────────────────────────────────

  /**
   * Invalidate groups whose rules depend on any of the given dimensions.
   * Sets resolved_at = NULL on matching groups → lazy re-resolution.
   */
  private async invalidateByDimensions(tenantId: string, dimensions: string[]): Promise<void> {
    await withTenant(this.db, mkInstituteCtx(tenantId), async (tx) => {
      // Find group_ids whose rules reference any of the given dimensions
      const affectedRules = await tx
        .select({ groupId: groupRules.groupId })
        .from(groupRules)
        .where(
          sql`${groupRules.ruleDimensions} && ARRAY[${sql.join(
            dimensions.map((d) => sql`${d}`),
            sql`, `,
          )}]::text[]`,
        );

      if (affectedRules.length === 0) return;

      const groupIds = affectedRules.map((r) => r.groupId);
      await tx
        .update(groups)
        .set({ resolvedAt: null })
        .where(
          sql`${groups.id} IN (${sql.join(
            groupIds.map((id) => sql`${id}::uuid`),
            sql`, `,
          )})`,
        );

      this.logger.log(
        `Invalidated ${groupIds.length} groups for dimensions: ${dimensions.join(', ')}`,
      );
    });
  }

  /** Invalidate ALL dynamic/hybrid groups in a tenant */
  private async invalidateAllDynamic(tenantId: string): Promise<void> {
    await withTenant(this.db, mkInstituteCtx(tenantId), async (tx) => {
      const result = await tx
        .update(groups)
        .set({ resolvedAt: null })
        .where(
          inArray(groups.membershipType, [GroupMembershipType.DYNAMIC, GroupMembershipType.HYBRID]),
        )
        .returning({ id: groups.id });

      this.logger.log(`Invalidated all ${result.length} dynamic/hybrid groups`);
    });
  }
}
