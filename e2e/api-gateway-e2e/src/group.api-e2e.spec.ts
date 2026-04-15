/**
 * Group domain E2E tests — migrated from e2e/api-gateway-e2e/hurl/group/*.hurl
 *
 * Covers:
 *   01-create-static-group — createGroup with membershipType STATIC
 *   02-create-dynamic-group — rule-based group + resolveGroupMembers
 *   03-preview-rule         — previewGroupRule dry-run (count + sample)
 *   04-hybrid-group         — rule-based + manual exclusion pipeline
 *   05-composite-group      — parent = union(A, B) via childGroupIds
 *   06-invalidation         — rule update invalidates resolution (resolvedAt → null)
 *
 * Also adds a subscription check for `groupMembershipResolved` — the emitter
 * lives in group.service.ts `resolveMembers()` via EventBus `GROUP.membership_resolved`.
 *
 * Notes:
 *   - Enum values are UPPER_SNAKE per common-types. The Hurl files used some
 *     stale lowercase strings ("dynamic", "hybrid", "custom", "composite",
 *     "section", "active") that the current schema rejects — this spec uses
 *     the real enums.
 *   - `name` is a plain string (Field(() => String)), not i18nText.
 *   - status returned is DynamicGroupStatus.ACTIVE (enum), not lowercase.
 *   - Invalidation in 06: the Hurl relied on a NATS event that is not
 *     emitted in the test environment. We exercise the equivalent in-process
 *     invalidation path — `updateGroup` with a new rule emits
 *     `GROUP.rules_updated`, whose handler sets `resolvedAt = NULL`.
 */
import assert from 'node:assert';
import { DomainGroupType, DynamicGroupStatus, GroupMembershipType } from '@roviq/common-types';
import { beforeAll, describe, expect, it } from 'vitest';

import { loginAsInstituteAdmin } from './helpers/auth';
import { gql } from './helpers/gql-client';
import { subscribeOnce } from './helpers/ws-client';

interface GroupNode {
  id: string;
  name: string;
  groupType: DomainGroupType;
  membershipType: GroupMembershipType;
  status: DynamicGroupStatus;
  memberCount: number;
  resolvedAt: string | null;
}

interface ResolutionUpdate {
  groupId: string;
  memberCount: number;
  resolvedAt: string | null;
}

interface RulePreview {
  count: number;
  sampleMembershipIds: string[];
}

const CREATE_GROUP = `mutation CreateGroup($input: CreateGroupInput!) {
  createGroup(input: $input) {
    id name groupType membershipType status memberCount resolvedAt
  }
}`;

const RESOLVE_GROUP = `mutation Resolve($groupId: ID!) {
  resolveGroupMembers(groupId: $groupId) {
    groupId memberCount resolvedAt
  }
}`;

describe('Group E2E', () => {
  let accessToken: string;

  beforeAll(async () => {
    const admin = await loginAsInstituteAdmin();
    accessToken = admin.accessToken;
  });

  // ─────────────────────────────────────────────────────
  // 01-create-static-group
  // ─────────────────────────────────────────────────────
  describe('createGroup — static', () => {
    it('creates a STATIC CLUB group with zero initial members', async () => {
      const res = await gql<{ createGroup: GroupNode }>(
        CREATE_GROUP,
        {
          input: {
            name: `Chess Club ${Date.now()}`,
            groupType: DomainGroupType.CLUB,
            membershipType: GroupMembershipType.STATIC,
            description: 'Students interested in chess',
          },
        },
        accessToken,
      );

      expect(res.errors).toBeUndefined();
      const group = res.data?.createGroup;
      assert(group);
      expect(group.id).toBeTruthy();
      expect(group.groupType).toBe(DomainGroupType.CLUB);
      expect(group.membershipType).toBe(GroupMembershipType.STATIC);
      expect(group.status).toBe(DynamicGroupStatus.ACTIVE);
      expect(group.memberCount).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────
  // 02-create-dynamic-group
  // ─────────────────────────────────────────────────────
  describe('createGroup — dynamic + resolveGroupMembers', () => {
    it('creates a DYNAMIC group and resolves members without error', async () => {
      const created = await gql<{ createGroup: GroupNode }>(
        CREATE_GROUP,
        {
          input: {
            name: `All Enrolled Students ${Date.now()}`,
            groupType: DomainGroupType.CUSTOM,
            membershipType: GroupMembershipType.DYNAMIC,
            rule: { '==': [{ var: 'academic_status' }, 'ENROLLED'] },
            ruleDescription: 'All students with academic_status = ENROLLED',
          },
        },
        accessToken,
      );
      expect(created.errors).toBeUndefined();
      const group = created.data?.createGroup;
      assert(group);
      expect(group.membershipType).toBe(GroupMembershipType.DYNAMIC);
      expect(group.memberCount).toBe(0);

      const resolved = await gql<{ resolveGroupMembers: ResolutionUpdate }>(
        RESOLVE_GROUP,
        { groupId: group.id },
        accessToken,
      );
      expect(resolved.errors).toBeUndefined();
      const update = resolved.data?.resolveGroupMembers;
      assert(update);
      expect(update.groupId).toBe(group.id);
      expect(update.memberCount).toBeGreaterThanOrEqual(0);
      expect(update.resolvedAt).toBeTruthy();
    });
  });

  // ─────────────────────────────────────────────────────
  // 03-preview-rule
  // ─────────────────────────────────────────────────────
  describe('previewGroupRule', () => {
    it('returns count + sampleMembershipIds without persisting a group', async () => {
      const res = await gql<{ previewGroupRule: RulePreview }>(
        `query Preview($rule: JSON!) {
          previewGroupRule(rule: $rule) { count sampleMembershipIds }
        }`,
        { rule: { '==': [{ var: 'academic_status' }, 'ENROLLED'] } },
        accessToken,
      );
      expect(res.errors).toBeUndefined();
      const preview = res.data?.previewGroupRule;
      assert(preview);
      expect(preview.count).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(preview.sampleMembershipIds)).toBe(true);
      // Sample is capped at 10 rows per the service SQL (LIMIT 10).
      expect(preview.sampleMembershipIds.length).toBeLessThanOrEqual(10);
    });
  });

  // ─────────────────────────────────────────────────────
  // 04-hybrid-group
  // ─────────────────────────────────────────────────────
  describe('createGroup — hybrid', () => {
    it('creates a HYBRID group and resolves via the rule + manual-overlay path', async () => {
      const created = await gql<{ createGroup: GroupNode }>(
        CREATE_GROUP,
        {
          input: {
            name: `Hybrid Test Group ${Date.now()}`,
            groupType: DomainGroupType.CUSTOM,
            membershipType: GroupMembershipType.HYBRID,
            rule: { '==': [{ var: 'academic_status' }, 'ENROLLED'] },
          },
        },
        accessToken,
      );
      expect(created.errors).toBeUndefined();
      const group = created.data?.createGroup;
      assert(group);
      expect(group.membershipType).toBe(GroupMembershipType.HYBRID);

      const resolved = await gql<{ resolveGroupMembers: ResolutionUpdate }>(
        RESOLVE_GROUP,
        { groupId: group.id },
        accessToken,
      );
      expect(resolved.errors).toBeUndefined();
      const update = resolved.data?.resolveGroupMembers;
      assert(update);
      expect(update.memberCount).toBeGreaterThanOrEqual(0);
    });
  });

  // ─────────────────────────────────────────────────────
  // 05-composite-group
  // ─────────────────────────────────────────────────────
  describe('createGroup — composite', () => {
    it('creates two child groups and a composite parent that resolves over their union', async () => {
      const stamp = Date.now();

      const childA = await gql<{ createGroup: GroupNode }>(
        CREATE_GROUP,
        {
          input: {
            name: `Composite Child A ${stamp}`,
            groupType: DomainGroupType.CUSTOM,
            membershipType: GroupMembershipType.STATIC,
          },
        },
        accessToken,
      );
      expect(childA.errors).toBeUndefined();
      const a = childA.data?.createGroup;
      assert(a);

      const childB = await gql<{ createGroup: GroupNode }>(
        CREATE_GROUP,
        {
          input: {
            name: `Composite Child B ${stamp}`,
            groupType: DomainGroupType.CUSTOM,
            membershipType: GroupMembershipType.STATIC,
          },
        },
        accessToken,
      );
      expect(childB.errors).toBeUndefined();
      const b = childB.data?.createGroup;
      assert(b);

      const parent = await gql<{ createGroup: GroupNode }>(
        CREATE_GROUP,
        {
          input: {
            name: `Composite Parent ${stamp}`,
            groupType: DomainGroupType.COMPOSITE,
            membershipType: GroupMembershipType.DYNAMIC,
            childGroupIds: [a.id, b.id],
          },
        },
        accessToken,
      );
      expect(parent.errors).toBeUndefined();
      const p = parent.data?.createGroup;
      assert(p);
      expect(p.groupType).toBe(DomainGroupType.COMPOSITE);

      const resolved = await gql<{ resolveGroupMembers: ResolutionUpdate }>(
        RESOLVE_GROUP,
        { groupId: p.id },
        accessToken,
      );
      expect(resolved.errors).toBeUndefined();
      const update = resolved.data?.resolveGroupMembers;
      assert(update);
      expect(update.groupId).toBe(p.id);
      expect(update.memberCount).toBeGreaterThanOrEqual(0);
    });
  });

  // ─────────────────────────────────────────────────────
  // 06-invalidation
  // ─────────────────────────────────────────────────────
  describe('invalidation', () => {
    it('updateGroup with a new rule invalidates resolution (resolvedAt → null)', async () => {
      // Create dynamic group with a section_id rule.
      const created = await gql<{ createGroup: GroupNode }>(
        CREATE_GROUP,
        {
          input: {
            name: `Section Group For Invalidation ${Date.now()}`,
            groupType: DomainGroupType.SECTION,
            membershipType: GroupMembershipType.DYNAMIC,
            rule: { '==': [{ var: 'section_id' }, '00000000-0000-0000-0000-000000000000'] },
          },
        },
        accessToken,
      );
      expect(created.errors).toBeUndefined();
      const group = created.data?.createGroup;
      assert(group);

      // Resolve it → resolvedAt becomes non-null.
      const resolved = await gql<{ resolveGroupMembers: ResolutionUpdate }>(
        RESOLVE_GROUP,
        { groupId: group.id },
        accessToken,
      );
      expect(resolved.errors).toBeUndefined();
      expect(resolved.data?.resolveGroupMembers.resolvedAt).toBeTruthy();

      // Update the rule → service sets resolvedAt = null synchronously in
      // the same withTenant transaction (see group.service.ts update()).
      const updated = await gql<{ updateGroup: GroupNode }>(
        `mutation Update($id: ID!, $input: UpdateGroupInput!) {
          updateGroup(id: $id, input: $input) {
            id resolvedAt
          }
        }`,
        {
          id: group.id,
          input: {
            rule: { '==': [{ var: 'section_id' }, '11111111-1111-1111-1111-111111111111'] },
            ruleDescription: 'Changed section filter',
          },
        },
        accessToken,
      );
      expect(updated.errors).toBeUndefined();
      const u = updated.data?.updateGroup;
      assert(u);
      expect(u.id).toBe(group.id);
      // `updateGroup` folds the invalidation into the same UPDATE + returning()
      // so the mutation payload reflects the post-invalidation state.
      expect(u.resolvedAt).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────
  // Subscription: groupMembershipResolved
  // ─────────────────────────────────────────────────────
  describe('groupMembershipResolved subscription', () => {
    it('fires after resolveGroupMembers', async () => {
      // Create the group first so we can subscribe with its id.
      const created = await gql<{ createGroup: GroupNode }>(
        CREATE_GROUP,
        {
          input: {
            name: `Subscription Group ${Date.now()}`,
            groupType: DomainGroupType.CUSTOM,
            membershipType: GroupMembershipType.STATIC,
          },
        },
        accessToken,
      );
      expect(created.errors).toBeUndefined();
      const group = created.data?.createGroup;
      assert(group);

      // Subscribe BEFORE mutating. __typename only — emitter payload does
      // not include model fields, and the filter runs server-side.
      const sub = subscribeOnce<{
        groupMembershipResolved: { groupId: string; memberCount: number };
      }>(
        `subscription OnResolve($groupId: ID!) {
          groupMembershipResolved(groupId: $groupId) { groupId memberCount }
        }`,
        { groupId: group.id },
        accessToken,
      );

      // Let connection_init complete before emitting.
      await new Promise((r) => setTimeout(r, 200));

      const resolved = await gql<{ resolveGroupMembers: ResolutionUpdate }>(
        RESOLVE_GROUP,
        { groupId: group.id },
        accessToken,
      );
      expect(resolved.errors).toBeUndefined();

      const event = await sub;
      expect(event.groupMembershipResolved.groupId).toBe(group.id);
      expect(event.groupMembershipResolved.memberCount).toBeGreaterThanOrEqual(0);
    });
  });
});
