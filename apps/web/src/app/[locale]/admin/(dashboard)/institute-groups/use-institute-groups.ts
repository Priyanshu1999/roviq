'use client';

import { gql, useMutation, useQuery } from '@roviq/graphql';
import type { InstituteGroupModel } from '@roviq/graphql/generated';

// ─── Types ──────────────────────────────────────────────────────────────────

export type InstituteGroupNode = InstituteGroupModel;

interface InstituteGroupConnectionData {
  adminListInstituteGroups: {
    edges: Array<{ node: InstituteGroupNode; cursor: string }>;
    totalCount: number;
    pageInfo: {
      hasNextPage: boolean;
      hasPreviousPage: boolean;
      endCursor: string | null;
      startCursor: string | null;
    };
  };
}

// ─── Fragment ───────────────────────────────────────────────────────────────

const INSTITUTE_GROUP_LIST_FIELDS = gql`
  fragment InstituteGroupListFields on InstituteGroupModel {
    id
    name
    code
    type
    status
    registrationNumber
  }
`;

// ─── List Query ─────────────────────────────────────────────────────────────

const GROUPS_QUERY = gql`
  query AdminListInstituteGroups($filter: InstituteGroupFilterInput) {
    adminListInstituteGroups(filter: $filter) {
      edges {
        cursor
        node {
          ...InstituteGroupListFields
        }
      }
      totalCount
      pageInfo {
        hasNextPage
        hasPreviousPage
        endCursor
        startCursor
      }
    }
  }
  ${INSTITUTE_GROUP_LIST_FIELDS}
`;

export function useInstituteGroups(variables?: { filter?: Record<string, unknown> }) {
  const filterWithPagination = { first: 20, ...variables?.filter };

  const { data, loading, error, fetchMore, refetch } = useQuery<InstituteGroupConnectionData>(
    GROUPS_QUERY,
    {
      variables: { filter: filterWithPagination },
      notifyOnNetworkStatusChange: true,
    },
  );

  const loadMore = () => {
    const endCursor = data?.adminListInstituteGroups.pageInfo.endCursor;
    if (!endCursor) return;
    return fetchMore({
      variables: { filter: { ...filterWithPagination, after: endCursor } },
    });
  };

  return {
    groups: data?.adminListInstituteGroups.edges.map((e) => e.node) ?? [],
    totalCount: data?.adminListInstituteGroups.totalCount ?? 0,
    hasNextPage: data?.adminListInstituteGroups.pageInfo.hasNextPage ?? false,
    loading,
    error,
    loadMore,
    refetch,
  };
}

// ─── Detail Query ───────────────────────────────────────────────────────────

const GROUP_DETAIL_FIELDS = gql`
  fragment InstituteGroupDetailFields on InstituteGroupModel {
    id
    name
    code
    type
    status
    registrationNumber
    registrationState
    contact { phones { countryCode number isPrimary isWhatsappEnabled label } emails { address isPrimary label } }
    address { line1 line2 line3 city district state postalCode country coordinates { lat lng } }
    version
    createdAt
    updatedAt
  }
`;

const GROUP_DETAIL_QUERY = gql`
  query AdminListInstituteGroupDetail($filter: InstituteGroupFilterInput) {
    adminListInstituteGroups(filter: $filter) {
      edges {
        node {
          ...InstituteGroupDetailFields
        }
      }
    }
  }
  ${GROUP_DETAIL_FIELDS}
`;

/**
 * Fetch a single institute group by loading the list and filtering client-side.
 * There is no dedicated `adminGetInstituteGroup(id)` query on the backend.
 */
export function useInstituteGroup(id: string) {
  const { data, loading, error, refetch } = useQuery<InstituteGroupConnectionData>(
    GROUP_DETAIL_QUERY,
    {
      variables: { filter: { first: 100 } },
      skip: !id,
    },
  );

  const group = data?.adminListInstituteGroups.edges.find((e) => e.node.id === id)?.node ?? null;

  return { group, loading, error, refetch };
}

// ─── Mutations ──────────────────────────────────────────────────────────────

const CREATE_GROUP = gql`
  mutation AdminCreateInstituteGroup($input: CreateInstituteGroupInput!) {
    adminCreateInstituteGroup(input: $input) {
      id
      name
      code
      type
      status
    }
  }
`;

const UPDATE_GROUP = gql`
  mutation AdminUpdateInstituteGroup($id: ID!, $input: UpdateInstituteGroupInput!) {
    adminUpdateInstituteGroup(id: $id, input: $input) {
      id
      name
      code
      type
      status
    }
  }
`;

const DELETE_GROUP = gql`
  mutation AdminDeleteInstituteGroup($id: ID!) {
    adminDeleteInstituteGroup(id: $id)
  }
`;

export function useCreateInstituteGroup() {
  return useMutation<
    { adminCreateInstituteGroup: InstituteGroupNode },
    { input: Record<string, unknown> }
  >(CREATE_GROUP, {
    refetchQueries: ['AdminListInstituteGroups'],
  });
}

export function useUpdateInstituteGroup() {
  return useMutation<
    { adminUpdateInstituteGroup: InstituteGroupNode },
    { id: string; input: Record<string, unknown> }
  >(UPDATE_GROUP, {
    refetchQueries: ['AdminListInstituteGroups'],
  });
}

export function useDeleteInstituteGroup() {
  return useMutation<{ adminDeleteInstituteGroup: boolean }, { id: string }>(DELETE_GROUP, {
    refetchQueries: ['AdminListInstituteGroups'],
  });
}
