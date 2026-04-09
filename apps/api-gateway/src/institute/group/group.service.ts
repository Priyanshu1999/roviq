/**
 * Group CRUD service (ROV-163).
 *
 * Handles group CRUD, dynamic rule-based resolution, composite group
 * resolution with recursive CTE, and hybrid (rule + manual) logic.
 */

import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  DRIZZLE_DB,
  type DrizzleDB,
  groupChildren,
  groupMembers,
  groupRules,
  groups,
  memberships,
  users,
  withAdmin,
  withTenant,
} from '@roviq/database';
import type { JsonLogicRule } from '@roviq/groups';
import { extractDimensions, groupRuleToDrizzleSql } from '@roviq/groups';
import { getRequestContext } from '@roviq/request-context';
import { and, count, eq, ilike, inArray, type SQL, sql } from 'drizzle-orm';
import { EventBusService } from '../../common/event-bus.service';
import type {
  CreateGroupInput,
  GroupFilterInput,
  UpdateGroupInput,
} from './dto/create-group.input';

/** Drizzle row type for the `groups` table — avoids `as GroupRecord` casts. */
type GroupRecord = typeof groups.$inferSelect;
import type {
  GroupMemberModel,
  GroupResolutionUpdate,
  RulePreviewResult,
} from './models/group.model';

@Injectable()
export class GroupService {
  private readonly logger = new Logger(GroupService.name);

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

  // ── CRUD ──────────────────────────────────────────────────

  async create(input: CreateGroupInput): Promise<GroupRecord> {
    const tenantId = this.getTenantId();
    const actorId = this.getUserId();

    const rows = await withTenant(this.db, tenantId, async (tx) => {
      // Create the group
      const newGroups = await tx
        .insert(groups)
        .values({
          tenantId,
          name: input.name,
          description: input.description ?? null,
          groupType: input.groupType,
          membershipType: input.membershipType ?? 'dynamic',
          memberTypes: input.memberTypes ?? ['student'],
          isSystem: input.isSystem ?? false,
          status: 'active',
          parentGroupId: input.parentGroupId ?? null,
          createdBy: actorId,
          updatedBy: actorId,
        })
        .returning();

      const groupId = newGroups[0].id;

      // Create rule if provided
      if (input.rule && Object.keys(input.rule).length > 0) {
        const dimensions = extractDimensions(input.rule);
        await tx.insert(groupRules).values({
          groupId,
          tenantId,
          rule: input.rule,
          ruleDimensions: dimensions,
          description: input.ruleDescription ?? null,
        });
      }

      // Create composite children if provided
      if (input.childGroupIds && input.childGroupIds.length > 0) {
        for (const childId of input.childGroupIds) {
          await tx.insert(groupChildren).values({
            parentGroupId: groupId,
            childGroupId: childId,
            tenantId,
          });
        }
      }

      return newGroups;
    });

    this.logger.log(`Group created: ${rows[0].id} (${input.groupType}/${input.membershipType})`);
    return rows[0] as GroupRecord;
  }

  async findById(id: string): Promise<GroupRecord> {
    const tenantId = this.getTenantId();
    const rows = await withTenant(this.db, tenantId, async (tx) => {
      return tx.select().from(groups).where(eq(groups.id, id)).limit(1);
    });
    if (rows.length === 0) throw new NotFoundException('Group not found');
    return rows[0] as GroupRecord;
  }

  async list(filter: GroupFilterInput): Promise<GroupRecord[]> {
    const tenantId = this.getTenantId();
    const conditions: SQL[] = [];
    if (filter.groupType) conditions.push(eq(groups.groupType, filter.groupType));
    if (filter.membershipType) conditions.push(eq(groups.membershipType, filter.membershipType));
    if (filter.status) conditions.push(eq(groups.status, filter.status));
    if (filter.search) conditions.push(ilike(groups.name, `%${filter.search}%`));

    return withTenant(this.db, tenantId, async (tx) => {
      const rows = await tx
        .select()
        .from(groups)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(groups.name);
      return rows as GroupRecord[];
    });
  }

  async update(id: string, input: UpdateGroupInput): Promise<GroupRecord> {
    const tenantId = this.getTenantId();
    const actorId = this.getUserId();

    const updates: Record<string, unknown> = { updatedBy: actorId };
    if (input.name !== undefined) updates.name = input.name;
    if (input.description !== undefined) updates.description = input.description;
    if (input.status !== undefined) updates.status = input.status;

    const rows = await withTenant(this.db, tenantId, async (tx) => {
      const updated = await tx.update(groups).set(updates).where(eq(groups.id, id)).returning();

      // Update rule if provided
      if (input.rule) {
        const dimensions = extractDimensions(input.rule);
        // Delete old rules and insert new
        await tx.delete(groupRules).where(eq(groupRules.groupId, id));
        await tx.insert(groupRules).values({
          groupId: id,
          tenantId,
          rule: input.rule,
          ruleDimensions: dimensions,
          description: input.ruleDescription ?? null,
        });

        // Invalidate group (set resolved_at = NULL for lazy re-resolution)
        await tx.update(groups).set({ resolvedAt: null }).where(eq(groups.id, id));

        this.eventBus.emit('GROUP.rules_updated', { groupId: id, tenantId });
      }

      return updated;
    });

    if (rows.length === 0) throw new NotFoundException('Group not found');
    return rows[0] as GroupRecord;
  }

  async delete(id: string): Promise<boolean> {
    const tenantId = this.getTenantId();
    const actorId = this.getUserId();
    const deleted = await withTenant(this.db, tenantId, async (tx) => {
      return tx
        .update(groups)
        .set({ deletedAt: new Date(), deletedBy: actorId, updatedBy: actorId })
        .where(and(eq(groups.id, id), sql`${groups.deletedAt} IS NULL`))
        .returning({ id: groups.id });
    });
    if (deleted.length === 0) throw new NotFoundException('Group not found');
    return true;
  }

  // ── RESOLUTION ────────────────────────────────────────────

  /**
   * Resolve group members based on membership_type:
   * - static: no-op (manual members only)
   * - dynamic: evaluate rules → matching membership_ids
   * - hybrid: rules + manual exclusions + manual additions
   * - composite: recursive CTE to resolve all child groups
   */
  async resolveMembers(groupId: string): Promise<GroupResolutionUpdate> {
    const tenantId = this.getTenantId();
    const actorId = this.getUserId();

    const group = await this.findById(groupId);

    if (group.membershipType === 'static') {
      // Count existing manual members
      const [{ total }] = await withTenant(this.db, tenantId, async (tx) => {
        return tx
          .select({ total: count() })
          .from(groupMembers)
          .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.isExcluded, false)));
      });

      const resolvedAt = new Date();
      await withTenant(this.db, tenantId, async (tx) => {
        await tx
          .update(groups)
          .set({ memberCount: total, resolvedAt, updatedBy: actorId })
          .where(eq(groups.id, groupId));
      });

      this.eventBus.emit('GROUP.membership_resolved', {
        groupId,
        memberCount: total,
        resolvedAt,
        tenantId,
      });

      return { groupId, memberCount: total, resolvedAt };
    }

    let matchingMembershipIds: string[] = [];

    if (group.groupType === 'composite') {
      matchingMembershipIds = await this.resolveComposite(tenantId, groupId);
    } else {
      matchingMembershipIds = await this.resolveDynamic(tenantId, groupId);
    }

    // For hybrid: apply manual exclusions and additions
    if (group.membershipType === 'hybrid') {
      const excluded = await withTenant(this.db, tenantId, async (tx) => {
        return tx
          .select({ membershipId: groupMembers.membershipId })
          .from(groupMembers)
          .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.isExcluded, true)));
      });
      const excludedSet = new Set(excluded.map((r) => r.membershipId));
      matchingMembershipIds = matchingMembershipIds.filter((id) => !excludedSet.has(id));

      // Add manual members
      const manual = await withTenant(this.db, tenantId, async (tx) => {
        return tx
          .select({ membershipId: groupMembers.membershipId })
          .from(groupMembers)
          .where(
            and(
              eq(groupMembers.groupId, groupId),
              eq(groupMembers.source, 'manual'),
              eq(groupMembers.isExcluded, false),
            ),
          );
      });
      const manualIds = manual.map((r) => r.membershipId);
      const allIds = new Set([...matchingMembershipIds, ...manualIds]);
      matchingMembershipIds = [...allIds];
    }

    // Delete old rule-resolved members
    await withTenant(this.db, tenantId, async (tx) => {
      await tx
        .delete(groupMembers)
        .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.source, 'rule')));

      // Insert new rule-resolved members
      if (matchingMembershipIds.length > 0) {
        const now = new Date();
        await tx
          .insert(groupMembers)
          .values(
            matchingMembershipIds.map((membershipId) => ({
              groupId,
              tenantId,
              membershipId,
              source: 'rule' as const,
              isExcluded: false,
              resolvedAt: now,
            })),
          )
          .onConflictDoNothing();
      }

      // Update group metadata
      await tx
        .update(groups)
        .set({
          memberCount: matchingMembershipIds.length,
          resolvedAt: new Date(),
          updatedBy: actorId,
        })
        .where(eq(groups.id, groupId));
    });

    this.eventBus.emit('GROUP.membership_resolved', {
      groupId,
      memberCount: matchingMembershipIds.length,
      resolvedAt: new Date(),
      tenantId,
    });

    this.logger.log(`Group ${groupId} resolved: ${matchingMembershipIds.length} members`);
    return {
      groupId,
      memberCount: matchingMembershipIds.length,
      resolvedAt: new Date(),
    };
  }

  /**
   * Preview a rule without saving — dry-run returns count + 10 sample members.
   */
  async previewRule(rule: JsonLogicRule): Promise<RulePreviewResult> {
    const tenantId = this.getTenantId();
    const whereClause = groupRuleToDrizzleSql(rule) ?? sql`true`;

    return withTenant(this.db, tenantId, async (tx) => {
      // Avoid table aliases — DIMENSION_TO_COLUMN emits fully-qualified
      // "table"."column" references that Postgres rejects when the FROM clause
      // uses aliases.
      const rows = await tx.execute(
        sql`SELECT student_profiles.membership_id FROM student_profiles
            INNER JOIN user_profiles ON user_profiles.user_id = student_profiles.user_id
            LEFT JOIN student_academics ON student_academics.student_profile_id = student_profiles.id
            LEFT JOIN sections ON sections.id = student_academics.section_id
            WHERE ${whereClause}
            LIMIT 10`,
      );

      const countRows = await tx.execute(
        sql`SELECT COUNT(*)::int AS total FROM student_profiles
            INNER JOIN user_profiles ON user_profiles.user_id = student_profiles.user_id
            LEFT JOIN student_academics ON student_academics.student_profile_id = student_profiles.id
            LEFT JOIN sections ON sections.id = student_academics.section_id
            WHERE ${whereClause}`,
      );

      return {
        count: (countRows.rows[0] as { total: number }).total,
        sampleMembershipIds: (rows.rows as { membership_id: string }[]).map((r) => r.membership_id),
      };
    });
  }

  // ── MEMBERS LIST & EXCLUSION TOGGLE ───────────────────────

  /**
   * List all group_members rows for a group (both active and excluded)
   * enriched with a best-effort display name drawn from the user record.
   *
   * Used by the group detail Members tab. Hybrid groups render a per-row
   * Exclude toggle that calls {@link setMemberExcluded}.
   */
  async listMembers(groupId: string): Promise<GroupMemberModel[]> {
    const tenantId = this.getTenantId();

    // 1. Fetch group_members (tenant-scoped via RLS).
    const rows = await withTenant(this.db, tenantId, async (tx) => {
      return tx
        .select({
          id: groupMembers.id,
          groupId: groupMembers.groupId,
          membershipId: groupMembers.membershipId,
          source: groupMembers.source,
          isExcluded: groupMembers.isExcluded,
          resolvedAt: groupMembers.resolvedAt,
        })
        .from(groupMembers)
        .where(eq(groupMembers.groupId, groupId))
        .orderBy(groupMembers.isExcluded, groupMembers.id);
    });

    if (rows.length === 0) return [];

    // 2. Resolve display names via memberships → users.
    //    `memberships` is tenant-scoped (withTenant), `users` is a platform
    //    table and must be read under withAdmin.
    const membershipIds = rows.map((r) => r.membershipId);
    const membershipRows = await withTenant(this.db, tenantId, async (tx) => {
      return tx
        .select({ id: memberships.id, userId: memberships.userId })
        .from(memberships)
        .where(inArray(memberships.id, membershipIds));
    });

    const userIds = membershipRows.map((m) => m.userId);
    const userRows =
      userIds.length > 0
        ? await withAdmin(this.db, async (tx) => {
            return tx
              .select({ id: users.id, username: users.username, email: users.email })
              .from(users)
              .where(inArray(users.id, userIds));
          })
        : [];

    const userById = new Map(userRows.map((u) => [u.id, u]));
    const displayByMembership = new Map<string, string>();
    for (const m of membershipRows) {
      const u = userById.get(m.userId);
      if (u) displayByMembership.set(m.id, u.username || u.email);
    }

    return rows.map((r) => ({
      id: r.id,
      groupId: r.groupId,
      membershipId: r.membershipId,
      source: r.source,
      isExcluded: r.isExcluded,
      resolvedAt: r.resolvedAt,
      displayName: displayByMembership.get(r.membershipId) ?? null,
    }));
  }

  /**
   * Toggle the `is_excluded` flag on a single group_member row.
   *
   * Used by the hybrid-group per-member Exclude toggle. Recomputes the
   * active member count (WHERE is_excluded = false) and emits
   * `GROUP.membership_resolved` so connected clients refresh live.
   */
  async setMemberExcluded(
    groupId: string,
    memberId: string,
    excluded: boolean,
  ): Promise<GroupMemberModel> {
    const tenantId = this.getTenantId();
    const actorId = this.getUserId();

    const updated = await withTenant(this.db, tenantId, async (tx) => {
      const rows = await tx
        .update(groupMembers)
        .set({ isExcluded: excluded })
        .where(and(eq(groupMembers.id, memberId), eq(groupMembers.groupId, groupId)))
        .returning();
      return rows;
    });

    if (updated.length === 0) throw new NotFoundException('Group member not found');

    // Recompute active count and update groups.memberCount + resolvedAt.
    const resolvedAt = new Date();
    const newCount = await withTenant(this.db, tenantId, async (tx) => {
      const [{ total }] = await tx
        .select({ total: count() })
        .from(groupMembers)
        .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.isExcluded, false)));

      await tx
        .update(groups)
        .set({ memberCount: total, resolvedAt, updatedBy: actorId })
        .where(eq(groups.id, groupId));

      return total;
    });

    this.eventBus.emit('GROUP.membership_resolved', {
      groupId,
      memberCount: newCount,
      resolvedAt,
      tenantId,
    });

    const row = updated[0];
    return {
      id: row.id,
      groupId: row.groupId,
      membershipId: row.membershipId,
      source: row.source,
      isExcluded: row.isExcluded,
      resolvedAt: row.resolvedAt,
      displayName: null,
    };
  }

  // ── PRIVATE HELPERS ───────────────────────────────────────

  /** Resolve dynamic group: evaluate JsonLogic rules → membership_ids */
  private async resolveDynamic(tenantId: string, groupId: string): Promise<string[]> {
    const ruleRows = await withTenant(this.db, tenantId, async (tx) => {
      return tx.select().from(groupRules).where(eq(groupRules.groupId, groupId));
    });

    if (ruleRows.length === 0) return [];

    // Convert each rule to a Drizzle SQL object with proper param binding
    const drizzleConditions = ruleRows
      .map((r) => groupRuleToDrizzleSql(r.rule as JsonLogicRule))
      .filter((c): c is NonNullable<typeof c> => c !== undefined);

    if (drizzleConditions.length === 0) return [];

    // Combine multiple rules with OR (any rule matching = member)
    const combinedWhere =
      drizzleConditions.length === 1
        ? drizzleConditions[0]
        : sql.join(drizzleConditions, sql` OR `);

    const rows = await withTenant(this.db, tenantId, async (tx) => {
      return tx.execute(
        sql`SELECT student_profiles.membership_id FROM student_profiles
            INNER JOIN user_profiles ON user_profiles.user_id = student_profiles.user_id
            LEFT JOIN student_academics ON student_academics.student_profile_id = student_profiles.id
            LEFT JOIN sections ON sections.id = student_academics.section_id
            WHERE ${combinedWhere}`,
      );
    });

    return (rows.rows as { membership_id: string }[]).map((r) => r.membership_id);
  }

  /**
   * Resolve composite group: WITH RECURSIVE CTE to collect all
   * child groups (max depth 5, cycle detection), then UNION their members.
   */
  private async resolveComposite(tenantId: string, groupId: string): Promise<string[]> {
    const rows = await withTenant(this.db, tenantId, async (tx) => {
      // Use recursive CTE to traverse the group hierarchy
      const result = await tx.execute(sql`
        WITH RECURSIVE group_tree AS (
          -- Base case: direct children of this composite group
          SELECT child_group_id AS group_id, 1 AS depth, ARRAY[${groupId}::uuid] AS path
          FROM group_children
          WHERE parent_group_id = ${groupId}::uuid

          UNION ALL

          -- Recursive case: children of children
          SELECT gc.child_group_id, gt.depth + 1, gt.path || gc.child_group_id
          FROM group_children gc
          INNER JOIN group_tree gt ON gt.group_id = gc.parent_group_id
          WHERE gt.depth < 5
            AND NOT gc.child_group_id = ANY(gt.path)  -- cycle detection
        )
        SELECT DISTINCT gm.membership_id
        FROM group_tree gt
        INNER JOIN group_members gm ON gm.group_id = gt.group_id
        WHERE gm.is_excluded = false
      `);

      return result.rows as { membership_id: string }[];
    });

    return rows.map((r) => r.membership_id);
  }
}
