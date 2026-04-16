import { gql, useMutation, useQuery, useSubscription } from '@roviq/graphql';
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
    resellerId
    groupId
    resellerName
    groupName
    departments
    isDemo
    contact { phones { countryCode number isPrimary isWhatsappEnabled label } emails { address isPrimary label } }
    address { line1 line2 line3 city district state postalCode country coordinates { lat lng } }
    affiliations { id board affiliationStatus }
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
    contact { phones { countryCode number isPrimary isWhatsappEnabled label } emails { address isPrimary label } }
    address { line1 line2 line3 city district state postalCode country coordinates { lat lng } }
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

/**
 * Approve an institute sitting in PENDING_APPROVAL — moves status to PENDING and
 * kicks off the Temporal setup workflow. Use on the approval queue + "Approve"
 * button for PENDING_APPROVAL institutes only.
 */
const APPROVE_INSTITUTE = gql`
  mutation AdminApproveInstitute($id: ID!) {
    adminApproveInstitute(id: $id) { id status setupStatus }
  }
`;

/**
 * Activate an institute (PENDING/INACTIVE/SUSPENDED → ACTIVE). Requires the
 * setup workflow to have completed. Use this for the "Activate" button on
 * INACTIVE or SUSPENDED institutes — NOT for approval of PENDING_APPROVAL.
 */
const ACTIVATE_INSTITUTE = gql`
  mutation AdminActivateInstitute($id: ID!) {
    adminActivateInstitute(id: $id) { id status setupStatus }
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

/**
 * Approve a PENDING_APPROVAL institute. Triggers the Temporal setup workflow.
 * Do NOT use for ACTIVATE transitions from INACTIVE/SUSPENDED — use
 * `useActivateInstitute` for those.
 */
export function useApproveInstitute() {
  return useMutation<
    { adminApproveInstitute: { id: string; status: string; setupStatus: string } },
    { id: string }
  >(APPROVE_INSTITUTE);
}

/**
 * Activate an institute (PENDING/INACTIVE/SUSPENDED → ACTIVE). Server verifies
 * `setupStatus === 'COMPLETED'` before the transition — otherwise throws
 * SETUP_NOT_COMPLETE.
 */
export function useActivateInstitute() {
  return useMutation<
    { adminActivateInstitute: { id: string; status: string; setupStatus: string } },
    { id: string }
  >(ACTIVATE_INSTITUTE);
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

const ADMIN_INSTITUTE_CREATED = gql`
  subscription AdminInstituteCreated {
    adminInstituteCreated {
      ...InstituteListFields
    }
  }
  ${INSTITUTE_LIST_FIELDS}
`;

const ADMIN_INSTITUTE_APPROVAL_REQUESTED = gql`
  subscription AdminInstituteApprovalRequested {
    adminInstituteApprovalRequested {
      ...InstituteListFields
    }
  }
  ${INSTITUTE_LIST_FIELDS}
`;

const ADMIN_SETUP_PROGRESS = gql`
  subscription AdminInstituteSetupProgress($instituteId: ID!) {
    adminInstituteSetupProgress(instituteId: $instituteId) {
      instituteId
      step
      status
      message
      completedSteps
      totalSteps
    }
  }
`;

export interface AdminInstituteCreatedData {
  adminInstituteCreated: import('./types').InstituteNode;
}

export interface AdminInstituteApprovalRequestedData {
  adminInstituteApprovalRequested: import('./types').InstituteNode;
}

export interface AdminSetupProgressData {
  adminInstituteSetupProgress: {
    instituteId: string;
    step: string;
    status:
      | 'pending'
      | 'in_progress'
      | 'completed'
      | 'failed'
      | 'PENDING'
      | 'IN_PROGRESS'
      | 'COMPLETED'
      | 'FAILED';
    message?: string | null;
    completedSteps: number;
    totalSteps: number;
  };
}

export function useAdminInstituteCreated() {
  return useSubscription<AdminInstituteCreatedData>(ADMIN_INSTITUTE_CREATED);
}

export function useAdminInstituteApprovalRequested() {
  return useSubscription<AdminInstituteApprovalRequestedData>(ADMIN_INSTITUTE_APPROVAL_REQUESTED);
}

export function useAdminSetupProgress(instituteId: string, skip = false) {
  return useSubscription<AdminSetupProgressData>(ADMIN_SETUP_PROGRESS, {
    variables: { instituteId },
    skip,
  });
}

// ─── Admin action mutations (reassign / group / retry) ────────────────────────

const REASSIGN_RESELLER = gql`
  mutation AdminReassignInstituteReseller($id: ID!, $newResellerId: ID!) {
    adminReassignInstituteReseller(id: $id, newResellerId: $newResellerId) {
      id
      resellerId
      resellerName
    }
  }
`;

const ASSIGN_GROUP = gql`
  mutation AdminAssignInstituteGroup($id: ID!, $groupId: ID!) {
    adminAssignInstituteGroup(id: $id, groupId: $groupId) {
      id
      groupId
      groupName
    }
  }
`;

const REMOVE_GROUP = gql`
  mutation AdminRemoveInstituteGroup($id: ID!) {
    adminRemoveInstituteGroup(id: $id) {
      id
      groupId
      groupName
    }
  }
`;

const RETRY_SETUP = gql`
  mutation AdminRetryInstituteSetup($id: ID!) {
    adminRetryInstituteSetup(id: $id) {
      id
      setupStatus
      status
    }
  }
`;

export function useReassignReseller() {
  return useMutation<
    { adminReassignInstituteReseller: { id: string; resellerId: string; resellerName?: string } },
    { id: string; newResellerId: string }
  >(REASSIGN_RESELLER);
}

export function useAssignGroup() {
  return useMutation<
    { adminAssignInstituteGroup: { id: string; groupId: string; groupName?: string } },
    { id: string; groupId: string }
  >(ASSIGN_GROUP);
}

export function useRemoveGroup() {
  return useMutation<
    {
      adminRemoveInstituteGroup: { id: string; groupId: string | null; groupName?: string | null };
    },
    { id: string }
  >(REMOVE_GROUP);
}

export function useRetrySetup() {
  return useMutation<
    { adminRetryInstituteSetup: { id: string; setupStatus: string; status: string } },
    { id: string }
  >(RETRY_SETUP);
}
