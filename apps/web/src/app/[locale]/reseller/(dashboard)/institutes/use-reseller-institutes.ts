import { gql, useMutation, useQuery } from '@roviq/graphql';

// ─── List (lightweight — only columns data) ──────────────────────────────

const RESELLER_INSTITUTES_QUERY = gql`
  query ResellerInstitutes($filter: InstituteFilterInput) {
    resellerListInstitutes(filter: $filter) {
      edges {
        cursor
        node {
          id
          name
          code
          type
          status
          setupStatus
          createdAt
        }
      }
      totalCount
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export function useResellerInstitutes(filter?: Record<string, unknown>) {
  const { data, loading, fetchMore, refetch } = useQuery<{
    resellerListInstitutes: {
      edges: Array<{ cursor: string; node: ResellerInstituteNode }>;
      totalCount: number;
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
    };
  }>(RESELLER_INSTITUTES_QUERY, {
    variables: { filter: { first: 20, ...filter } },
    notifyOnNetworkStatusChange: true,
  });

  const loadMore = () => {
    const endCursor = data?.resellerListInstitutes.pageInfo.endCursor;
    if (!endCursor) return;
    return fetchMore({
      variables: { filter: { first: 20, ...filter, after: endCursor } },
    });
  };

  return {
    institutes: data?.resellerListInstitutes.edges.map((e) => e.node) ?? [],
    totalCount: data?.resellerListInstitutes.totalCount ?? 0,
    hasNextPage: data?.resellerListInstitutes.pageInfo.hasNextPage ?? false,
    loading,
    loadMore,
    refetch,
  };
}

// ─── Detail (fetches more fields) ────────────────────────────────────────

const RESELLER_INSTITUTE_QUERY = gql`
  query ResellerInstitute($id: ID!) {
    resellerGetInstitute(id: $id) {
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
      status
      createdAt
      updatedAt
    }
  }
`;

export function useResellerInstitute(id: string) {
  return useQuery<{ resellerGetInstitute: ResellerInstituteDetail }>(RESELLER_INSTITUTE_QUERY, {
    variables: { id },
    skip: !id,
  });
}

// ─── Mutations ───────────────────────────────────────────────────────────

const CREATE_INSTITUTE_REQUEST = gql`
  mutation ResellerCreateInstituteRequest($input: ResellerCreateInstituteRequestInput!) {
    resellerCreateInstituteRequest(input: $input) {
      id
      name
      code
      status
    }
  }
`;

const SUSPEND_INSTITUTE = gql`
  mutation SuspendInstitute($id: ID!) {
    suspendInstitute(id: $id) { id status }
  }
`;

const ACTIVATE_INSTITUTE = gql`
  mutation ResellerActivateInstitute($id: ID!) {
    activateInstitute(id: $id) { id status }
  }
`;

export function useResellerCreateInstituteRequest() {
  return useMutation<
    {
      resellerCreateInstituteRequest: {
        id: string;
        name: Record<string, string>;
        code: string;
        status: string;
      };
    },
    { input: Record<string, unknown> }
  >(CREATE_INSTITUTE_REQUEST, { refetchQueries: ['ResellerInstitutes'] });
}

export function useResellerSuspendInstitute() {
  return useMutation<{ suspendInstitute: { id: string; status: string } }, { id: string }>(
    SUSPEND_INSTITUTE,
  );
}

export function useResellerReactivateInstitute() {
  return useMutation<{ activateInstitute: { id: string; status: string } }, { id: string }>(
    ACTIVATE_INSTITUTE,
  );
}

// ─── Institute Groups ────────────────────────────────────────────────────

const RESELLER_GROUPS_QUERY = gql`
  query ResellerInstituteGroups {
    resellerListInstituteGroups
  }
`;

const CREATE_GROUP = gql`
  mutation ResellerCreateInstituteGroup($input: CreateInstituteGroupInput!) {
    resellerCreateInstituteGroup(input: $input)
  }
`;

export function useResellerInstituteGroups() {
  return useQuery<{ resellerListInstituteGroups: unknown }>(RESELLER_GROUPS_QUERY);
}

export function useResellerCreateInstituteGroup() {
  return useMutation<{ resellerCreateInstituteGroup: unknown }, { input: Record<string, unknown> }>(
    CREATE_GROUP,
    { refetchQueries: ['ResellerInstituteGroups'] },
  );
}

// ─── Types ───────────────────────────────────────────────────────────────

export interface ResellerInstituteNode {
  id: string;
  name: Record<string, string>;
  code?: string | null;
  type: 'SCHOOL' | 'COACHING' | 'LIBRARY';
  status: 'PENDING_APPROVAL' | 'PENDING' | 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'REJECTED';
  setupStatus: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  createdAt: string;
  /** Name of the institute group this institute belongs to, if any. */
  groupName?: string | null;
}

export interface ResellerInstituteIdentifier {
  type: string;
  value: string;
  issuedBy?: string | null;
  validUntil?: string | null;
}

export interface ResellerInstituteAffiliation {
  board: string;
  affiliationStatus: string;
  affiliationNumber?: string | null;
  grantedLevel?: string | null;
  validTo?: string | null;
}

export interface ResellerInstituteDetail extends ResellerInstituteNode {
  slug: string;
  structureFramework: string;
  contact: {
    phones: Array<{
      country_code: string;
      number: string;
      is_primary: boolean;
      is_whatsapp_enabled: boolean;
      label: string;
    }>;
    emails: Array<{ address: string; is_primary: boolean; label: string }>;
  };
  address?: {
    line1: string;
    line2?: string;
    line3?: string;
    city: string;
    district: string;
    state: string;
    postal_code: string;
  } | null;
  logoUrl?: string | null;
  timezone: string;
  currency: string;
  updatedAt: string;
  /** Regulatory identifiers for this institute (UDISE, PAN, etc.). */
  identifiers?: ResellerInstituteIdentifier[];
  /** Board affiliation records for this institute. */
  affiliations?: ResellerInstituteAffiliation[];
}
