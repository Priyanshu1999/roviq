/**
 * ROV-170 — Integration tests for GroupResolver (institute-scoped).
 *
 * Covers createGroup (static), previewGroupRule (dry-run SQL eval),
 * resolveGroupMembers (static no-op updates resolved_at), and cross-scope
 * rejection. Real pipeline: scope guard → CASL → service → withTenant → RLS.
 */
import { DynamicGroupStatus } from '@roviq/common-types';
import {
  createInstituteToken,
  createIntegrationApp,
  createResellerToken,
  createTestInstitute,
  gqlRequest,
  type IntegrationAppResult,
} from '@roviq/testing/integration';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../../../app/app.module';

const FAKE = {
  USER: '00000000-0000-4000-a000-000000000dff',
  MEMBERSHIP: '00000000-0000-4000-a000-000000000dfe',
  ROLE: '00000000-0000-4000-a000-000000000dfd',
  RESELLER: '00000000-0000-4000-a000-000000000dfb',
} as const;

const CREATE_GROUP = /* GraphQL */ `
  mutation CreateGroup($input: CreateGroupInput!) {
    createGroup(input: $input) {
      id
      name
      groupType
      membershipType
      status
    }
  }
`;

const PREVIEW_GROUP_RULE = /* GraphQL */ `
  query PreviewGroupRule($rule: JSON!) {
    previewGroupRule(rule: $rule) {
      count
      sampleMembershipIds
    }
  }
`;

const RESOLVE_GROUP_MEMBERS = /* GraphQL */ `
  mutation ResolveGroupMembers($groupId: ID!) {
    resolveGroupMembers(groupId: $groupId) {
      groupId
      memberCount
      resolvedAt
    }
  }
`;

interface CreateGroupResponse {
  createGroup: {
    id: string;
    name: string;
    groupType: string;
    membershipType: string;
    status: DynamicGroupStatus;
  };
}
interface PreviewResponse {
  previewGroupRule: { count: number; sampleMembershipIds: string[] };
}
interface ResolveResponse {
  resolveGroupMembers: { groupId: string; memberCount: number; resolvedAt: string };
}

describe('GroupResolver (integration)', () => {
  let result: IntegrationAppResult;
  let instituteToken: string;
  let createdGroupId: string;

  beforeAll(async () => {
    result = await createIntegrationApp({ modules: [AppModule] });
    const institute = await createTestInstitute(result.db);
    instituteToken = createInstituteToken({
      sub: institute.userId,
      tenantId: institute.tenantId,
      membershipId: institute.membershipId,
      roleId: institute.roleId,
    });
  });

  afterAll(async () => {
    await result?.close();
  });

  it('createGroup persists a static group for the current tenant', async () => {
    const response = await gqlRequest<CreateGroupResponse>(result.httpServer, {
      query: CREATE_GROUP,
      token: instituteToken,
      variables: {
        input: {
          name: 'Science Club',
          description: 'Weekly meetup for science enthusiasts',
          groupType: 'club',
          membershipType: 'static',
          memberTypes: ['student'],
        },
      },
    });
    expect(response.errors).toBeUndefined();
    expect(response.data?.createGroup.id).toBeDefined();
    expect(response.data?.createGroup.name).toBe('Science Club');
    expect(response.data?.createGroup.membershipType).toBe('static');
    expect(response.data?.createGroup.status).toBe(DynamicGroupStatus.ACTIVE);
    createdGroupId = response.data?.createGroup.id ?? '';
  });

  it('previewGroupRule returns a count and sample list for a trivial rule', async () => {
    // A rule that always matches the academic-status column — the SQL executes
    // against student_profiles for the current tenant. Result count may be 0
    // for a freshly created institute, which is fine — we assert shape only.
    const response = await gqlRequest<PreviewResponse>(result.httpServer, {
      query: PREVIEW_GROUP_RULE,
      token: instituteToken,
      variables: {
        rule: { '==': [{ var: 'academic_status' }, 'enrolled'] },
      },
    });
    expect(response.errors).toBeUndefined();
    expect(typeof response.data?.previewGroupRule.count).toBe('number');
    expect(Array.isArray(response.data?.previewGroupRule.sampleMembershipIds)).toBe(true);
  });

  it('resolveGroupMembers on a static group returns a resolution update with resolvedAt', async () => {
    expect(createdGroupId).toBeTruthy();
    const response = await gqlRequest<ResolveResponse>(result.httpServer, {
      query: RESOLVE_GROUP_MEMBERS,
      token: instituteToken,
      variables: { groupId: createdGroupId },
    });
    expect(response.errors).toBeUndefined();
    expect(response.data?.resolveGroupMembers.groupId).toBe(createdGroupId);
    expect(response.data?.resolveGroupMembers.memberCount).toBe(0);
    expect(response.data?.resolveGroupMembers.resolvedAt).toBeTruthy();
  });

  it('reseller token is rejected with FORBIDDEN on createGroup', async () => {
    const resellerToken = createResellerToken({
      sub: FAKE.USER,
      resellerId: FAKE.RESELLER,
      membershipId: FAKE.MEMBERSHIP,
      roleId: FAKE.ROLE,
    });
    const response = await gqlRequest(result.httpServer, {
      query: CREATE_GROUP,
      token: resellerToken,
      variables: {
        input: { name: 'Cross-scope attempt', groupType: 'club', membershipType: 'static' },
      },
    });
    expect(response.errors).toBeDefined();
    expect(response.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
  });
});
