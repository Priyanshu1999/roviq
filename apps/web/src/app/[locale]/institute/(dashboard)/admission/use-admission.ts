'use client';

import { gql, useMutation, useQuery, useSubscription } from '@roviq/graphql';
import type {
  AcademicYearModel,
  AdmissionApplicationStatus,
  AdmissionStatisticsModel,
  ApplicationFilterInput,
  ApplicationModel,
  ApplicationStatusUpdate,
  CreateApplicationInput,
  CreateEnquiryInput,
  EnquiryFilterInput,
  EnquiryModel,
  EnquirySource,
  EnquiryStatus,
  FunnelStage,
  SourceBreakdown,
  StandardModel,
  UpdateEnquiryInput,
} from '@roviq/graphql/generated';

/**
 * ROV-168 — Admission CRM frontend hooks.
 *
 * Mirrors the pattern in ../people/students/use-students.ts: each page in the
 * admission module imports typed wrappers from here so the `.graphql` string
 * surface stays in one file (single source of truth for codegen) and each
 * page stays focused on presentation.
 */

// ─── Enquiry fragment ─────────────────────────────────────────────────────

const ENQUIRY_FIELDS = `
  id
  tenantId
  studentName
  dateOfBirth
  gender
  classRequested
  academicYearId
  parentName
  parentPhone
  parentEmail
  parentRelation
  source
  referredBy
  assignedTo
  previousSchool
  previousBoard
  siblingInSchool
  siblingAdmissionNo
  specialNeeds
  notes
  status
  followUpDate
  lastContactedAt
  convertedToApplicationId
  isDuplicate
  createdAt
  updatedAt
`;

const LIST_ENQUIRIES_QUERY = gql`
  query InstituteListEnquiries($filter: EnquiryFilterInput) {
    listEnquiries(filter: $filter) {
      edges {
        cursor
        node {
          ${ENQUIRY_FIELDS}
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

export function useEnquiries(filter?: EnquiryFilterInput) {
  const { data, loading, refetch, fetchMore } = useQuery<{
    listEnquiries: {
      edges: Array<{ cursor: string; node: EnquiryNode }>;
      totalCount: number;
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
    };
  }>(LIST_ENQUIRIES_QUERY, {
    variables: { filter: { first: 25, ...filter } },
    notifyOnNetworkStatusChange: true,
  });

  return {
    enquiries: data?.listEnquiries.edges.map((e) => e.node) ?? [],
    totalCount: data?.listEnquiries.totalCount ?? 0,
    hasNextPage: data?.listEnquiries.pageInfo.hasNextPage ?? false,
    endCursor: data?.listEnquiries.pageInfo.endCursor ?? null,
    loading,
    refetch,
    fetchMore,
  };
}

// ─── Enquiry mutations ────────────────────────────────────────────────────

const CREATE_ENQUIRY = gql`
  mutation InstituteCreateEnquiry($input: CreateEnquiryInput!) {
    createEnquiry(input: $input) {
      ${ENQUIRY_FIELDS}
    }
  }
`;

export function useCreateEnquiry() {
  return useMutation<{ createEnquiry: EnquiryNode }, { input: CreateEnquiryInput }>(
    CREATE_ENQUIRY,
    { refetchQueries: ['InstituteListEnquiries'] },
  );
}

const UPDATE_ENQUIRY = gql`
  mutation InstituteUpdateEnquiry($id: ID!, $input: UpdateEnquiryInput!) {
    updateEnquiry(id: $id, input: $input) {
      ${ENQUIRY_FIELDS}
    }
  }
`;

export function useUpdateEnquiry() {
  return useMutation<{ updateEnquiry: EnquiryNode }, { id: string; input: UpdateEnquiryInput }>(
    UPDATE_ENQUIRY,
    { refetchQueries: ['InstituteListEnquiries'] },
  );
}

const CONVERT_ENQUIRY = gql`
  mutation InstituteConvertEnquiry(
    $enquiryId: ID!
    $standardId: ID!
    $academicYearId: ID!
  ) {
    convertEnquiryToApplication(
      enquiryId: $enquiryId
      standardId: $standardId
      academicYearId: $academicYearId
    ) {
      id
      status
      standardId
      academicYearId
      enquiryId
    }
  }
`;

export function useConvertEnquiry() {
  return useMutation<
    {
      convertEnquiryToApplication: Pick<
        ApplicationModel,
        'id' | 'status' | 'standardId' | 'academicYearId' | 'enquiryId'
      >;
    },
    { enquiryId: string; standardId: string; academicYearId: string }
  >(CONVERT_ENQUIRY, {
    refetchQueries: ['InstituteListEnquiries', 'InstituteListApplications'],
  });
}

// ─── Enquiry subscription (ZAQWT/ZBKYJ) ───────────────────────────────────

const ENQUIRY_CREATED_SUB = gql`
  subscription InstituteEnquiryCreated {
    enquiryCreated {
      ${ENQUIRY_FIELDS}
    }
  }
`;

/**
 * Subscribe to `enquiryCreated`. Callback fires with the freshly-created
 * enquiry node for every event published to the tenant's topic.
 */
export function useEnquiryCreated(onEvent: (enquiry: EnquiryNode) => void) {
  useSubscription<{ enquiryCreated: EnquiryNode }>(ENQUIRY_CREATED_SUB, {
    onData: ({ data }) => {
      const node = data.data?.enquiryCreated;
      if (node) onEvent(node);
    },
  });
}

// ─── Application queries ──────────────────────────────────────────────────

const APPLICATION_FIELDS = `
  id
  tenantId
  enquiryId
  academicYearId
  standardId
  sectionId
  formData
  status
  isRteApplication
  testScore
  interviewScore
  meritRank
  rteLotteryRank
  offeredAt
  offerExpiresAt
  offerAcceptedAt
  studentProfileId
  version
  createdAt
  updatedAt
`;

const LIST_APPLICATIONS_QUERY = gql`
  query InstituteListApplications($filter: ApplicationFilterInput) {
    listApplications(filter: $filter) {
      edges {
        cursor
        node {
          ${APPLICATION_FIELDS}
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

export function useApplications(filter?: ApplicationFilterInput) {
  const { data, loading, refetch, fetchMore } = useQuery<{
    listApplications: {
      edges: Array<{ cursor: string; node: ApplicationNode }>;
      totalCount: number;
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
    };
  }>(LIST_APPLICATIONS_QUERY, {
    variables: { filter: { first: 25, ...filter } },
    notifyOnNetworkStatusChange: true,
  });

  return {
    applications: data?.listApplications.edges.map((e) => e.node) ?? [],
    totalCount: data?.listApplications.totalCount ?? 0,
    hasNextPage: data?.listApplications.pageInfo.hasNextPage ?? false,
    endCursor: data?.listApplications.pageInfo.endCursor ?? null,
    loading,
    refetch,
    fetchMore,
  };
}

const GET_APPLICATION_QUERY = gql`
  query InstituteGetApplication($id: ID!) {
    getApplication(id: $id) {
      ${APPLICATION_FIELDS}
    }
  }
`;

export function useApplication(id: string) {
  return useQuery<{ getApplication: ApplicationNode }>(GET_APPLICATION_QUERY, {
    variables: { id },
    skip: !id,
  });
}

// ─── Application mutations ────────────────────────────────────────────────

const CREATE_APPLICATION = gql`
  mutation InstituteCreateApplication($input: CreateApplicationInput!) {
    createApplication(input: $input) {
      ${APPLICATION_FIELDS}
    }
  }
`;

export function useCreateApplication() {
  return useMutation<{ createApplication: ApplicationNode }, { input: CreateApplicationInput }>(
    CREATE_APPLICATION,
    { refetchQueries: ['InstituteListApplications'] },
  );
}

const UPDATE_APPLICATION = gql`
  mutation InstituteUpdateApplication($id: ID!, $input: UpdateApplicationInput!) {
    updateApplication(id: $id, input: $input) {
      ${APPLICATION_FIELDS}
    }
  }
`;

/**
 * UpdateApplication: status transitions are validated by the backend state
 * machine; invalid transitions throw INVALID_STATUS_TRANSITION (422). The
 * frontend still limits the dropdown to valid next statuses so the user
 * never sees that error in normal flows.
 */
export function useUpdateApplication() {
  return useMutation<
    { updateApplication: ApplicationNode },
    {
      id: string;
      input: {
        status: string;
        sectionId?: string;
        formData?: Record<string, unknown>;
        testScore?: string;
        interviewScore?: string;
        meritRank?: number;
      };
    }
  >(UPDATE_APPLICATION, { refetchQueries: ['InstituteListApplications'] });
}

const APPROVE_APPLICATION = gql`
  mutation InstituteApproveApplication($id: ID!) {
    approveApplication(id: $id) {
      ${APPLICATION_FIELDS}
    }
  }
`;

export function useApproveApplication() {
  return useMutation<{ approveApplication: ApplicationNode }, { id: string }>(APPROVE_APPLICATION, {
    refetchQueries: ['InstituteListApplications'],
  });
}

const REJECT_APPLICATION = gql`
  mutation InstituteRejectApplication($id: ID!, $reason: String) {
    rejectApplication(id: $id, reason: $reason) {
      ${APPLICATION_FIELDS}
    }
  }
`;

export function useRejectApplication() {
  return useMutation<{ rejectApplication: ApplicationNode }, { id: string; reason?: string }>(
    REJECT_APPLICATION,
    { refetchQueries: ['InstituteListApplications'] },
  );
}

// ─── Application status subscription ──────────────────────────────────────

const APPLICATION_STATUS_SUB = gql`
  subscription InstituteApplicationStatusChanged {
    applicationStatusChanged {
      applicationId
      oldStatus
      newStatus
    }
  }
`;

export function useApplicationStatusChanged(onEvent: (update: ApplicationStatusUpdate) => void) {
  useSubscription<{ applicationStatusChanged: ApplicationStatusUpdate }>(APPLICATION_STATUS_SUB, {
    onData: ({ data }) => {
      const node = data.data?.applicationStatusChanged;
      if (node) onEvent(node);
    },
  });
}

// ─── Statistics query ─────────────────────────────────────────────────────

const ADMISSION_STATISTICS_QUERY = gql`
  query InstituteAdmissionStatistics($filter: AdmissionStatisticsFilterInput) {
    admissionStatistics(filter: $filter) {
      totalEnquiries
      totalApplications
      enquiryToApplicationRate
      applicationToEnrolledRate
      funnel {
        stage
        count
      }
      bySource {
        source
        enquiryCount
        applicationCount
      }
    }
  }
`;

export interface AdmissionStatisticsFilter {
  /** Inclusive lower bound (ISO date YYYY-MM-DD) */
  from?: string;
  /** Inclusive upper bound (ISO date YYYY-MM-DD) */
  to?: string;
}

export function useAdmissionStatistics(filter?: AdmissionStatisticsFilter) {
  return useQuery<
    { admissionStatistics: AdmissionStatisticsModel },
    { filter?: AdmissionStatisticsFilter }
  >(ADMISSION_STATISTICS_QUERY, {
    variables: { filter },
    fetchPolicy: 'cache-and-network',
  });
}

// ─── Academic years + standards pickers ───────────────────────────────────

const ACADEMIC_YEARS_QUERY = gql`
  query AcademicYearsForAdmission {
    academicYears {
      id
      label
      isActive
      startDate
      endDate
    }
  }
`;

export function useAcademicYearsForAdmission() {
  return useQuery<{ academicYears: AcademicYearPickerNode[] }>(ACADEMIC_YEARS_QUERY);
}

const STANDARDS_QUERY = gql`
  query StandardsForAdmission($academicYearId: ID!) {
    standards(academicYearId: $academicYearId) {
      id
      name
      numericOrder
    }
  }
`;

export function useStandardsForAdmission(academicYearId: string | null | undefined) {
  return useQuery<{ standards: StandardPickerNode[] }>(STANDARDS_QUERY, {
    variables: { academicYearId: academicYearId ?? '' },
    skip: !academicYearId,
  });
}

// ─── Types ────────────────────────────────────────────────────────────────

export type EnquiryNode = EnquiryModel;
export type ApplicationNode = ApplicationModel;

export type AcademicYearPickerNode = Pick<
  AcademicYearModel,
  'id' | 'label' | 'isActive' | 'startDate' | 'endDate'
>;

export type StandardPickerNode = Pick<StandardModel, 'id' | 'name' | 'numericOrder'>;

export type FunnelStageNode = FunnelStage;
export type SourceBreakdownNode = SourceBreakdown;

export type EnquiryFilter = EnquiryFilterInput;
export type ApplicationFilter = ApplicationFilterInput;

/**
 * Re-export backend-generated enum unions so pages import from one place.
 * If codegen picks up a new value on the next `tilt logs codegen` tick, it
 * flows through here automatically.
 */
export type EnquiryStatusValue = EnquiryStatus;
export type EnquirySourceValue = EnquirySource;
export type ApplicationStatusValue = AdmissionApplicationStatus;
