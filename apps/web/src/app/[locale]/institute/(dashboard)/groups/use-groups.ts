'use client';

import { gql, useLazyQuery, useMutation, useQuery, useSubscription } from '@roviq/graphql';
import type { GroupMemberSource, GroupMembershipType } from '@roviq/graphql/generated';

// ─── Fragments ──────────────────────────────────────────────────────────────

const GROUP_FIELDS = `
  id
  name
  description
  groupType
  membershipType
  memberTypes
  memberCount
  status
  isSystem
  parentGroupId
  resolvedAt
  createdAt
  updatedAt
  version
`;

const LIST_GROUPS_QUERY = gql`
  query ListGroups($filter: GroupFilterInput) {
    listGroups(filter: $filter) {
      ${GROUP_FIELDS}
    }
  }
`;

const GET_GROUP_QUERY = gql`
  query GetGroup($id: ID!) {
    getGroup(id: $id) {
      ${GROUP_FIELDS}
    }
  }
`;

const CREATE_GROUP_MUTATION = gql`
  mutation CreateGroup($input: CreateGroupInput!) {
    createGroup(input: $input) {
      ${GROUP_FIELDS}
    }
  }
`;

const UPDATE_GROUP_MUTATION = gql`
  mutation UpdateGroup($id: ID!, $input: UpdateGroupInput!) {
    updateGroup(id: $id, input: $input) {
      ${GROUP_FIELDS}
    }
  }
`;

const DELETE_GROUP_MUTATION = gql`
  mutation DeleteGroup($id: ID!) {
    deleteGroup(id: $id)
  }
`;

const RESOLVE_GROUP_MEMBERS_MUTATION = gql`
  mutation ResolveGroupMembers($groupId: ID!) {
    resolveGroupMembers(groupId: $groupId) {
      groupId
      memberCount
      resolvedAt
    }
  }
`;

const PREVIEW_GROUP_RULE_QUERY = gql`
  query PreviewGroupRule($rule: JSON!) {
    previewGroupRule(rule: $rule) {
      count
      sampleMembershipIds
    }
  }
`;

const GROUP_MEMBER_FIELDS = `
  id
  groupId
  membershipId
  source
  isExcluded
  resolvedAt
  displayName
`;

const LIST_GROUP_MEMBERS_QUERY = gql`
  query ListGroupMembers($groupId: ID!) {
    listGroupMembers(groupId: $groupId) {
      ${GROUP_MEMBER_FIELDS}
    }
  }
`;

const SET_GROUP_MEMBER_EXCLUDED_MUTATION = gql`
  mutation SetGroupMemberExcluded($groupId: ID!, $memberId: ID!, $excluded: Boolean!) {
    setGroupMemberExcluded(groupId: $groupId, memberId: $memberId, excluded: $excluded) {
      ${GROUP_MEMBER_FIELDS}
    }
  }
`;

const GROUP_MEMBERSHIP_RESOLVED_SUBSCRIPTION = gql`
  subscription GroupMembershipResolved($groupId: ID!) {
    groupMembershipResolved(groupId: $groupId) {
      groupId
      memberCount
      resolvedAt
    }
  }
`;

// ─── Types ──────────────────────────────────────────────────────────────────

/**
 * JsonLogic-style rule node used by the dynamic group engine.
 * The outer object has exactly one operator key (e.g. `and`, `or`, `==`)
 * whose value is the operand list.
 */
export type GroupRule = Record<string, unknown>;

export interface GroupNode {
  id: string;
  name: string;
  description?: string | null;
  groupType: string;
  membershipType: GroupMembershipType;
  memberTypes: string[];
  memberCount: number;
  status: string;
  isSystem: boolean;
  parentGroupId?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface GroupDetailNode extends GroupNode {}

export interface GroupListFilter {
  search?: string;
  groupType?: string;
  membershipType?: string;
  status?: string;
}

export interface CreateGroupInput {
  name: string;
  description?: string;
  groupType: string;
  membershipType?: string;
  memberTypes?: string[];
  parentGroupId?: string;
  childGroupIds?: string[];
  rule?: GroupRule;
  ruleDescription?: string;
  isSystem?: boolean;
}

export interface UpdateGroupInput {
  name?: string;
  description?: string;
  status?: string;
  rule?: GroupRule;
  ruleDescription?: string;
}

export interface RulePreviewResult {
  count: number;
  sampleMembershipIds: string[];
}

export interface GroupResolutionUpdate {
  groupId: string;
  memberCount: number;
  resolvedAt?: string | null;
}

export interface GroupMemberNode {
  id: string;
  groupId: string;
  membershipId: string;
  source: GroupMemberSource;
  isExcluded: boolean;
  resolvedAt?: string | null;
  displayName?: string | null;
}

// ─── Hooks ──────────────────────────────────────────────────────────────────

export function useGroups(filter?: GroupListFilter) {
  const { data, loading, refetch } = useQuery<{ listGroups: GroupNode[] }>(LIST_GROUPS_QUERY, {
    variables: { filter: filter ?? {} },
    notifyOnNetworkStatusChange: true,
  });
  return {
    groups: data?.listGroups ?? [],
    loading,
    refetch,
  };
}

export function useGroup(id: string) {
  return useQuery<{ getGroup: GroupDetailNode }>(GET_GROUP_QUERY, {
    variables: { id },
    skip: !id,
    notifyOnNetworkStatusChange: true,
  });
}

export function useCreateGroup() {
  return useMutation<{ createGroup: GroupNode }, { input: CreateGroupInput }>(
    CREATE_GROUP_MUTATION,
    { refetchQueries: ['ListGroups'] },
  );
}

export function useUpdateGroup() {
  return useMutation<{ updateGroup: GroupNode }, { id: string; input: UpdateGroupInput }>(
    UPDATE_GROUP_MUTATION,
    { refetchQueries: ['ListGroups', 'GetGroup'] },
  );
}

export function useDeleteGroup() {
  return useMutation<{ deleteGroup: boolean }, { id: string }>(DELETE_GROUP_MUTATION, {
    refetchQueries: ['ListGroups'],
  });
}

export function useResolveGroupMembers() {
  return useMutation<{ resolveGroupMembers: GroupResolutionUpdate }, { groupId: string }>(
    RESOLVE_GROUP_MEMBERS_MUTATION,
    {
      refetchQueries: ['ListGroups', 'GetGroup'],
    },
  );
}

/**
 * Imperative preview hook — backed by `useLazyQuery` because `previewGroupRule`
 * is a Query in the schema (dry-run, no side effects).
 */
export function usePreviewGroupRule() {
  return useLazyQuery<{ previewGroupRule: RulePreviewResult }, { rule: GroupRule }>(
    PREVIEW_GROUP_RULE_QUERY,
    { fetchPolicy: 'network-only' },
  );
}

export function useGroupMembers(groupId: string) {
  return useQuery<{ listGroupMembers: GroupMemberNode[] }, { groupId: string }>(
    LIST_GROUP_MEMBERS_QUERY,
    {
      variables: { groupId },
      skip: !groupId,
      notifyOnNetworkStatusChange: true,
    },
  );
}

export function useSetGroupMemberExcluded() {
  return useMutation<
    { setGroupMemberExcluded: GroupMemberNode },
    { groupId: string; memberId: string; excluded: boolean }
  >(SET_GROUP_MEMBER_EXCLUDED_MUTATION, {
    refetchQueries: ['ListGroupMembers', 'GetGroup'],
  });
}

/**
 * Subscribe to real-time group resolution updates.
 *
 * Fires whenever `GROUP.membership_resolved` is published for `groupId`
 * (e.g. after resolveGroupMembers or setGroupMemberExcluded).
 */
export function useGroupMembershipResolvedSubscription(
  groupId: string,
  onData: (update: GroupResolutionUpdate) => void,
) {
  return useSubscription<{ groupMembershipResolved: GroupResolutionUpdate }, { groupId: string }>(
    GROUP_MEMBERSHIP_RESOLVED_SUBSCRIPTION,
    {
      variables: { groupId },
      skip: !groupId,
      onData: ({ data }) => {
        const payload = data.data?.groupMembershipResolved;
        if (payload) onData(payload);
      },
    },
  );
}
