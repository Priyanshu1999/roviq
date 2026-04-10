import { gql, useMutation, useQuery } from '@roviq/graphql';
import type { CreateInstituteData, InstituteDetailData, InstitutesConnectionData } from './types';

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
    createdAt
    updatedAt
    branding {
      id
      logoUrl
      faviconUrl
      primaryColor
      secondaryColor
      themeIdentifier
      coverImageUrl
    }
    config {
      id
      attendanceType
      openingTime
      closingTime
      shifts {
        name
        start
        end
      }
      notificationPreferences
      payrollConfig
      gradingSystem
      termStructure {
        label
        startDate
        endDate
      }
      sectionStrengthNorms {
        optimal
        hardMax
        exemptionAllowed
      }
      admissionNumberConfig {
        format
        yearFormat
        prefixes
        noPrefixFromClass
      }
    }
    identifiers {
      id
      type
      value
      issuingAuthority
      validFrom
      validTo
    }
    affiliations {
      id
      board
      affiliationStatus
      affiliationNumber
      grantedLevel
      validFrom
      validTo
      nocNumber
      nocDate
    }
  }
`;

// ─── List Query ──────────────────────────────────────────────────────────────

const INSTITUTES_QUERY = gql`
  query AdminInstitutes($filter: AdminListInstitutesFilterInput) {
    adminListInstitutes(filter: $filter) {
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

export function useInstitutes(variables: { filter?: Record<string, unknown> }) {
  const filterWithPagination = { first: 20, ...variables.filter };

  const { data, loading, error, fetchMore, refetch } = useQuery<InstitutesConnectionData>(
    INSTITUTES_QUERY,
    {
      variables: { filter: filterWithPagination },
      notifyOnNetworkStatusChange: true,
    },
  );

  const loadMore = () => {
    const endCursor = data?.adminListInstitutes.pageInfo.endCursor;
    if (!endCursor) return;
    return fetchMore({
      variables: { filter: { ...filterWithPagination, after: endCursor } },
    });
  };

  return {
    institutes: data?.adminListInstitutes.edges.map((e) => e.node) ?? [],
    totalCount: data?.adminListInstitutes.totalCount ?? 0,
    hasNextPage: data?.adminListInstitutes.pageInfo.hasNextPage ?? false,
    loading,
    error,
    loadMore,
    refetch,
  };
}

// ─── Detail Query ────────────────────────────────────────────────────────────

const INSTITUTE_QUERY = gql`
  query AdminInstitute($id: ID!) {
    adminGetInstitute(id: $id) {
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
  mutation AdminCreateInstitute($input: AdminCreateInstituteInput!) {
    adminCreateInstitute(input: $input) {
      ...InstituteDetailFields
    }
  }
  ${INSTITUTE_DETAIL_FIELDS}
`;

const APPROVE_INSTITUTE = gql`
  mutation AdminApproveInstitute($id: ID!) {
    adminApproveInstitute(id: $id) { id status setupStatus }
  }
`;

const REJECT_INSTITUTE = gql`
  mutation AdminRejectInstitute($id: ID!, $reason: String!) {
    adminRejectInstitute(id: $id, reason: $reason) { id status }
  }
`;

const DEACTIVATE_INSTITUTE = gql`
  mutation AdminDeactivateInstitute($id: ID!) {
    adminDeactivateInstitute(id: $id) { id status }
  }
`;

const SUSPEND_INSTITUTE = gql`
  mutation AdminSuspendInstitute($id: ID!, $reason: String) {
    adminSuspendInstitute(id: $id, reason: $reason) { id status }
  }
`;

const DELETE_INSTITUTE = gql`
  mutation AdminDeleteInstitute($id: ID!) {
    adminDeleteInstitute(id: $id)
  }
`;

const RESTORE_INSTITUTE = gql`
  mutation AdminRestoreInstitute($id: ID!) {
    adminRestoreInstitute(id: $id) { id status }
  }
`;

export function useCreateInstitute() {
  return useMutation<CreateInstituteData, { input: Record<string, unknown> }>(CREATE_INSTITUTE);
}

export function useActivateInstitute() {
  return useMutation<{ adminApproveInstitute: { id: string; status: string } }, { id: string }>(
    APPROVE_INSTITUTE,
  );
}

export function useDeactivateInstitute() {
  return useMutation<{ adminDeactivateInstitute: { id: string; status: string } }, { id: string }>(
    DEACTIVATE_INSTITUTE,
  );
}

export function useSuspendInstitute() {
  return useMutation<
    { adminSuspendInstitute: { id: string; status: string } },
    { id: string; reason?: string }
  >(SUSPEND_INSTITUTE);
}

export function useRejectInstitute() {
  return useMutation<
    { adminRejectInstitute: { id: string; status: string } },
    { id: string; reason: string }
  >(REJECT_INSTITUTE);
}

export function useDeleteInstitute() {
  return useMutation<{ adminDeleteInstitute: boolean }, { id: string }>(DELETE_INSTITUTE);
}

export function useRestoreInstitute() {
  return useMutation<{ adminRestoreInstitute: { id: string; status: string } }, { id: string }>(
    RESTORE_INSTITUTE,
  );
}

// ─── Subscriptions ───────────────────────────────────────────────────────────

// const INSTITUTE_SETUP_PROGRESS = gql`
//   subscription InstituteSetupProgress {
//     instituteSetupProgress
//   }
// `;

// export function useSetupProgressSubscription() {
//   return useSubscription<SetupProgressPayload>(INSTITUTE_SETUP_PROGRESS);
// }
