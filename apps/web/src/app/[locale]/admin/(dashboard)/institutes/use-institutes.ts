import { gql, useMutation, useQuery, useSubscription } from '@roviq/graphql';
import type {
  CreateInstituteData,
  InstituteDetailData,
  InstitutesConnectionData,
  SetupProgressPayload,
} from './types';

// ─── Fragment ────────────────────────────────────────────────────────────────

const INSTITUTE_LIST_FIELDS = gql`
  fragment InstituteListFields on InstituteModel {
    id
    name
    slug
    code
    type
    structureFramework
    setupStatus
    status
    logoUrl
    timezone
    currency
    createdAt
    updatedAt
    contact
    address
    settings
  }
`;

const INSTITUTE_DETAIL_FIELDS = gql`
  fragment InstituteDetailFields on InstituteModel {
    id
    name
    slug
    code
    type
    structureFramework
    setupStatus
    contact
    address
    logoUrl
    timezone
    currency
    settings
    status
    version
    createdAt
    updatedAt
    branding
    config
    identifiers
    affiliations
    departments
  }
`;

// ─── List Query ──────────────────────────────────────────────────────────────

const INSTITUTES_QUERY = gql`
  query AdminInstitutes($filter: InstituteFilterInput, $first: Int, $after: String) {
    institutes(filter: $filter, first: $first, after: $after) {
      edges {
        cursor
        node {
          ...InstituteListFields
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
  ${INSTITUTE_LIST_FIELDS}
`;

export function useInstitutes(variables: {
  filter?: Record<string, unknown>;
  first?: number;
  after?: string;
}) {
  const { data, loading, error, fetchMore, refetch } = useQuery<InstitutesConnectionData>(
    INSTITUTES_QUERY,
    {
      variables: { first: 20, ...variables },
      notifyOnNetworkStatusChange: true,
    },
  );

  const loadMore = () => {
    const endCursor = data?.institutes.pageInfo.endCursor;
    if (!endCursor) return;
    return fetchMore({
      variables: { ...variables, first: 20, after: endCursor },
    });
  };

  return {
    institutes: data?.institutes.edges.map((e) => e.node) ?? [],
    totalCount: data?.institutes.totalCount ?? 0,
    hasNextPage: data?.institutes.pageInfo.hasNextPage ?? false,
    loading,
    error,
    loadMore,
    refetch,
  };
}

// ─── Detail Query ────────────────────────────────────────────────────────────

const INSTITUTE_QUERY = gql`
  query AdminInstitute($id: ID!) {
    institute(id: $id) {
      ...InstituteDetailFields
    }
  }
  ${INSTITUTE_DETAIL_FIELDS}
`;

export function useInstitute(id: string) {
  return useQuery<InstituteDetailData>(INSTITUTE_QUERY, {
    variables: { id },
    skip: !id,
  });
}

// ─── Mutations ───────────────────────────────────────────────────────────────

const CREATE_INSTITUTE = gql`
  mutation AdminCreateInstitute($input: CreateInstituteInput!) {
    createInstitute(input: $input) {
      ...InstituteDetailFields
    }
  }
  ${INSTITUTE_DETAIL_FIELDS}
`;

const ACTIVATE_INSTITUTE = gql`
  mutation ActivateInstitute($id: ID!) {
    activateInstitute(id: $id) { id status setupStatus }
  }
`;

const DEACTIVATE_INSTITUTE = gql`
  mutation DeactivateInstitute($id: ID!) {
    deactivateInstitute(id: $id) { id status }
  }
`;

const SUSPEND_INSTITUTE = gql`
  mutation SuspendInstitute($id: ID!) {
    suspendInstitute(id: $id) { id status }
  }
`;

const REJECT_INSTITUTE = gql`
  mutation RejectInstitute($id: ID!) {
    rejectInstitute(id: $id) { id status }
  }
`;

const DELETE_INSTITUTE = gql`
  mutation DeleteInstitute($id: ID!) {
    deleteInstitute(id: $id)
  }
`;

const RESTORE_INSTITUTE = gql`
  mutation RestoreInstitute($id: ID!) {
    restoreInstitute(id: $id) { id status }
  }
`;

export function useCreateInstitute() {
  return useMutation<CreateInstituteData, { input: Record<string, unknown> }>(CREATE_INSTITUTE);
}

export function useActivateInstitute() {
  return useMutation<{ activateInstitute: { id: string; status: string } }, { id: string }>(
    ACTIVATE_INSTITUTE,
  );
}

export function useDeactivateInstitute() {
  return useMutation<{ deactivateInstitute: { id: string; status: string } }, { id: string }>(
    DEACTIVATE_INSTITUTE,
  );
}

export function useSuspendInstitute() {
  return useMutation<{ suspendInstitute: { id: string; status: string } }, { id: string }>(
    SUSPEND_INSTITUTE,
  );
}

export function useRejectInstitute() {
  return useMutation<{ rejectInstitute: { id: string; status: string } }, { id: string }>(
    REJECT_INSTITUTE,
  );
}

export function useDeleteInstitute() {
  return useMutation<{ deleteInstitute: boolean }, { id: string }>(DELETE_INSTITUTE);
}

export function useRestoreInstitute() {
  return useMutation<{ restoreInstitute: { id: string; status: string } }, { id: string }>(
    RESTORE_INSTITUTE,
  );
}

// ─── Subscriptions ───────────────────────────────────────────────────────────

const INSTITUTE_SETUP_PROGRESS = gql`
  subscription InstituteSetupProgress {
    instituteSetupProgress
  }
`;

export function useSetupProgressSubscription() {
  return useSubscription<SetupProgressPayload>(INSTITUTE_SETUP_PROGRESS);
}
