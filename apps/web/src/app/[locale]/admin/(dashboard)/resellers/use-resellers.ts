import { gql, useMutation, useQuery, useSubscription } from '@roviq/graphql';
import type {
  ChangeResellerTierData,
  CreateResellerData,
  CreateResellerInput,
  ResellerDetailData,
  ResellersConnectionData,
  UpdateResellerData,
  UpdateResellerInput,
} from './types';

// ─── Fragments ────────────────────────────────────────────────────────────────

const RESELLER_LIST_FIELDS = gql`
  fragment ResellerListFields on AdminResellerModel {
    id
    name
    slug
    tier
    status
    isSystem
    isActive
    customDomain
    instituteCount
    teamSize
    suspendedAt
    createdAt
    updatedAt
  }
`;

const RESELLER_DETAIL_FIELDS = gql`
  fragment ResellerDetailFields on AdminResellerModel {
    id
    name
    slug
    tier
    status
    isSystem
    isActive
    customDomain
    suspendedAt
    deletedAt
    createdAt
    updatedAt
    instituteCount
    teamSize
    branding {
      logoUrl
      faviconUrl
      primaryColor
      secondaryColor
    }
  }
`;

// ─── List Query ───────────────────────────────────────────────────────────────

const RESELLERS_QUERY = gql`
  query AdminListResellers($filter: AdminListResellersFilterInput) {
    adminListResellers(filter: $filter) {
      edges {
        cursor
        node {
          ...ResellerListFields
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
  ${RESELLER_LIST_FIELDS}
`;

export function useResellers(variables: { filter?: Record<string, unknown> }) {
  const filterWithPagination = { first: 20, ...variables.filter };

  const { data, loading, error, fetchMore, refetch } = useQuery<ResellersConnectionData>(
    RESELLERS_QUERY,
    {
      variables: { filter: filterWithPagination },
      notifyOnNetworkStatusChange: true,
    },
  );

  const loadMore = () => {
    const endCursor = data?.adminListResellers.pageInfo.endCursor;
    if (!endCursor) return;
    return fetchMore({
      variables: { filter: { ...filterWithPagination, after: endCursor } },
    });
  };

  return {
    resellers: data?.adminListResellers.edges.map((e) => e.node) ?? [],
    totalCount: data?.adminListResellers.totalCount ?? 0,
    hasNextPage: data?.adminListResellers.pageInfo.hasNextPage ?? false,
    loading,
    error,
    loadMore,
    refetch,
  };
}

// ─── Detail Query ─────────────────────────────────────────────────────────────

const RESELLER_QUERY = gql`
  query AdminGetReseller($id: ID!) {
    adminGetReseller(id: $id) {
      ...ResellerDetailFields
    }
  }
  ${RESELLER_DETAIL_FIELDS}
`;

export function useReseller(id: string) {
  return useQuery<ResellerDetailData>(RESELLER_QUERY, {
    variables: { id },
    skip: !id,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

const CREATE_RESELLER = gql`
  mutation AdminCreateReseller($input: AdminCreateResellerInput!) {
    adminCreateReseller(input: $input) {
      ...ResellerDetailFields
    }
  }
  ${RESELLER_DETAIL_FIELDS}
`;

export function useCreateReseller() {
  return useMutation<CreateResellerData, { input: CreateResellerInput }>(CREATE_RESELLER);
}

const UPDATE_RESELLER = gql`
  mutation AdminUpdateReseller($id: ID!, $input: AdminUpdateResellerInput!) {
    adminUpdateReseller(id: $id, input: $input) {
      ...ResellerDetailFields
    }
  }
  ${RESELLER_DETAIL_FIELDS}
`;

export function useUpdateReseller() {
  return useMutation<UpdateResellerData, { id: string; input: UpdateResellerInput }>(
    UPDATE_RESELLER,
  );
}

const CHANGE_RESELLER_TIER = gql`
  mutation AdminChangeResellerTier($id: ID!, $newTier: ResellerTier!) {
    adminChangeResellerTier(id: $id, newTier: $newTier) {
      ...ResellerDetailFields
    }
  }
  ${RESELLER_DETAIL_FIELDS}
`;

export function useChangeResellerTier() {
  return useMutation<ChangeResellerTierData, { id: string; newTier: string }>(CHANGE_RESELLER_TIER);
}

const SUSPEND_RESELLER = gql`
  mutation AdminSuspendReseller($resellerId: String!, $reason: String) {
    adminSuspendReseller(resellerId: $resellerId, reason: $reason)
  }
`;

export function useSuspendReseller() {
  return useMutation<{ adminSuspendReseller: boolean }, { resellerId: string; reason?: string }>(
    SUSPEND_RESELLER,
  );
}

const UNSUSPEND_RESELLER = gql`
  mutation AdminUnsuspendReseller($resellerId: String!) {
    adminUnsuspendReseller(resellerId: $resellerId)
  }
`;

export function useUnsuspendReseller() {
  return useMutation<{ adminUnsuspendReseller: boolean }, { resellerId: string }>(
    UNSUSPEND_RESELLER,
  );
}

const DELETE_RESELLER = gql`
  mutation AdminDeleteReseller($resellerId: String!) {
    adminDeleteReseller(resellerId: $resellerId)
  }
`;

export function useDeleteReseller() {
  return useMutation<{ adminDeleteReseller: boolean }, { resellerId: string }>(DELETE_RESELLER);
}

// ─── Subscriptions ────────────────────────────────────────────────────────────

const ADMIN_RESELLER_CREATED = gql`
  subscription AdminResellerCreated {
    adminResellerCreated {
      ...ResellerListFields
    }
  }
  ${RESELLER_LIST_FIELDS}
`;

const ADMIN_RESELLER_UPDATED = gql`
  subscription AdminResellerUpdated {
    adminResellerUpdated {
      ...ResellerListFields
    }
  }
  ${RESELLER_LIST_FIELDS}
`;

const ADMIN_RESELLER_STATUS_CHANGED = gql`
  subscription AdminResellerStatusChanged {
    adminResellerStatusChanged {
      ...ResellerListFields
    }
  }
  ${RESELLER_LIST_FIELDS}
`;

export interface AdminResellerCreatedData {
  adminResellerCreated: import('./types').ResellerNode;
}

export interface AdminResellerUpdatedData {
  adminResellerUpdated: import('./types').ResellerNode;
}

export interface AdminResellerStatusChangedData {
  adminResellerStatusChanged: import('./types').ResellerNode;
}

export function useAdminResellerCreated() {
  return useSubscription<AdminResellerCreatedData>(ADMIN_RESELLER_CREATED);
}

export function useAdminResellerUpdated() {
  return useSubscription<AdminResellerUpdatedData>(ADMIN_RESELLER_UPDATED);
}

export function useAdminResellerStatusChanged() {
  return useSubscription<AdminResellerStatusChangedData>(ADMIN_RESELLER_STATUS_CHANGED);
}
