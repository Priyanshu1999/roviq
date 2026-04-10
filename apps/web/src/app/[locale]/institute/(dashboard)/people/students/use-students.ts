import type { AcademicStatus, TcStatus } from '@roviq/common-types';
import { gql, useLazyQuery, useMutation, useQuery, useSubscription } from '@roviq/graphql';

/**
 * Minimal student fields needed by the list view — keeps the payload small
 * and avoids fetching heavy nested objects (medicalInfo, guardian links, etc.)
 * until the detail page is opened.
 */
const STUDENT_LIST_FIELDS = `
  id
  admissionNumber
  firstName
  lastName
  gender
  socialCategory
  academicStatus
  isRteAdmitted
  currentStudentAcademicId
  currentStandardId
  currentSectionId
  currentStandardName
  currentSectionName
  primaryGuardianFirstName
  primaryGuardianLastName
  admissionDate
  createdAt
  updatedAt
  version
`;

const STUDENTS_LIST_QUERY = gql`
  query InstituteStudents($filter: StudentFilterInput) {
    listStudents(filter: $filter) {
      edges {
        cursor
        node {
          ${STUDENT_LIST_FIELDS}
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

/**
 * Dedicated export query — uses a large `first` window so CSV export
 * honors every filter + sort, not just the currently-loaded page.
 */
const STUDENTS_EXPORT_QUERY = gql`
  query InstituteStudentsExport($filter: StudentFilterInput) {
    listStudents(filter: $filter) {
      edges {
        node {
          ${STUDENT_LIST_FIELDS}
        }
      }
      totalCount
    }
  }
`;

export interface StudentListFilter {
  search?: string;
  standardId?: string;
  sectionId?: string;
  /** Multi-select academic status — matches backend `[String!]`. */
  academicStatus?: string[];
  gender?: string;
  socialCategory?: string;
  isRteAdmitted?: boolean;
  academicYearId?: string;
  /** Sort directive, e.g. `admissionNumber:asc`. */
  orderBy?: string;
  first?: number;
  after?: string;
}

export function useStudents(filter?: StudentListFilter) {
  const { data, loading, fetchMore, refetch } = useQuery<{
    listStudents: {
      edges: Array<{ cursor: string; node: StudentListNode }>;
      totalCount: number;
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
    };
  }>(STUDENTS_LIST_QUERY, {
    variables: { filter: { first: 25, ...filter } },
    notifyOnNetworkStatusChange: true,
  });

  const loadMore = () => {
    const endCursor = data?.listStudents.pageInfo.endCursor;
    if (!endCursor) return;
    return fetchMore({
      variables: { filter: { first: 25, ...filter, after: endCursor } },
    });
  };

  return {
    students: data?.listStudents.edges.map((e) => e.node) ?? [],
    totalCount: data?.listStudents.totalCount ?? 0,
    hasNextPage: data?.listStudents.pageInfo.hasNextPage ?? false,
    loading,
    loadMore,
    refetch,
  };
}

/**
 * Lazy query used by the "Export CSV" button. Fetches the full filtered
 * set (up to 10,000 rows) in one shot so the exported file reflects every
 * filter/sort currently applied on the list — not just the loaded page.
 */
export function useStudentsExport() {
  return useLazyQuery<{
    listStudents: {
      edges: Array<{ node: StudentListNode }>;
      totalCount: number;
    };
  }>(STUDENTS_EXPORT_QUERY);
}

// ─── Live tenant-wide updates ─────────────────────────────────────────────

const STUDENTS_IN_TENANT_UPDATED_SUBSCRIPTION = gql`
  subscription StudentsInTenantUpdated {
    studentsInTenantUpdated {
      id
    }
  }
`;

/**
 * Subscribes to `studentsInTenantUpdated` and calls the supplied callback
 * on every event. The backend filters by `tenantId` from the JWT, so the
 * frontend only receives events for its own tenant.
 */
export function useStudentsInTenantUpdated(onEvent: () => void) {
  useSubscription<{ studentsInTenantUpdated: { id: string } }>(
    STUDENTS_IN_TENANT_UPDATED_SUBSCRIPTION,
    {
      onData: () => {
        onEvent();
      },
    },
  );
}

// ─── Standards + academic years lookup queries ────────────────────────────

const STANDARDS_BY_YEAR_QUERY = gql`
  query StandardsForStudentsList($academicYearId: ID!) {
    standards(academicYearId: $academicYearId) {
      id
      name
      numericOrder
    }
  }
`;

export interface StandardPickerNode {
  id: string;
  name: string;
  numericOrder: number;
}

export function useStandardsForYear(academicYearId: string | null | undefined) {
  return useQuery<{ standards: StandardPickerNode[] }>(STANDARDS_BY_YEAR_QUERY, {
    variables: { academicYearId: academicYearId ?? '' },
    skip: !academicYearId,
  });
}

const ACADEMIC_YEARS_QUERY = gql`
  query AcademicYearsForStudentsList {
    academicYears {
      id
      label
      isActive
      startDate
      endDate
    }
  }
`;

export interface AcademicYearNode {
  id: string;
  /** Human-readable label like "2025–26" — schema field is `label`, not `name`. */
  label: string;
  isActive: boolean;
  startDate: string;
  endDate: string;
}

export function useAcademicYearsForStudents() {
  return useQuery<{ academicYears: AcademicYearNode[] }>(ACADEMIC_YEARS_QUERY);
}

// ─── Single student detail ────────────────────────────────────────────────

const STUDENT_DETAIL_QUERY = gql`
  query InstituteStudent($id: ID!) {
    getStudent(id: $id) {
      id
      admissionNumber
      firstName
      lastName
      gender
      dateOfBirth
      bloodGroup
      religion
      caste
      motherTongue
      socialCategory
      academicStatus
      admissionClass
      admissionDate
      admissionType
      currentStudentAcademicId
      currentStandardId
      currentSectionId
      currentAcademicYearId
      rollNumber
      profileImageUrl
      isRteAdmitted
      isCwsn
      cwsnType
      isMinority
      minorityType
      isBpl
      previousSchoolName
      previousSchoolBoard
      tcIssued
      tcIssuedDate
      tcNumber
      tcReason
      dateOfLeaving
      medicalInfo
      createdAt
      updatedAt
      version
    }
  }
`;

export function useStudent(id: string) {
  return useQuery<{ getStudent: StudentDetailNode }>(STUDENT_DETAIL_QUERY, {
    variables: { id },
    skip: !id,
  });
}

// ─── Academic year history for a student ─────────────────────────────────

const STUDENT_ACADEMICS_QUERY = gql`
  query InstituteStudentAcademics($studentProfileId: ID!) {
    listStudentAcademics(studentProfileId: $studentProfileId) {
      id
      studentProfileId
      academicYearId
      academicYearLabel
      isCurrentYear
      standardId
      standardName
      sectionId
      sectionName
      rollNumber
      promotionStatus
      createdAt
      updatedAt
    }
  }
`;

export interface StudentAcademicHistoryNode {
  id: string;
  studentProfileId: string;
  academicYearId: string;
  academicYearLabel: string;
  isCurrentYear: boolean;
  standardId?: string | null;
  standardName?: string | null;
  sectionId?: string | null;
  sectionName?: string | null;
  rollNumber?: string | null;
  promotionStatus?: string | null;
  createdAt: string;
  updatedAt: string;
}

export function useStudentAcademics(studentProfileId: string) {
  return useQuery<{ listStudentAcademics: StudentAcademicHistoryNode[] }>(STUDENT_ACADEMICS_QUERY, {
    variables: { studentProfileId },
    skip: !studentProfileId,
  });
}

// ─── Guardians linked to a student ────────────────────────────────────────

const STUDENT_GUARDIANS_QUERY = gql`
  query InstituteStudentGuardians($studentProfileId: ID!) {
    listStudentGuardians(studentProfileId: $studentProfileId) {
      linkId
      guardianProfileId
      userId
      firstName
      lastName
      profileImageUrl
      occupation
      organization
      relationship
      isPrimaryContact
      isEmergencyContact
      canPickup
      livesWith
    }
  }
`;

export interface StudentGuardianNode {
  linkId: string;
  guardianProfileId: string;
  userId: string;
  firstName: Record<string, string>;
  lastName?: Record<string, string> | null;
  profileImageUrl?: string | null;
  occupation?: string | null;
  organization?: string | null;
  relationship: string;
  isPrimaryContact: boolean;
  isEmergencyContact: boolean;
  canPickup: boolean;
  livesWith: boolean;
}

export function useStudentGuardians(studentProfileId: string) {
  return useQuery<{ listStudentGuardians: StudentGuardianNode[] }>(STUDENT_GUARDIANS_QUERY, {
    variables: { studentProfileId },
    skip: !studentProfileId,
  });
}

// ─── Documents uploaded for a student ─────────────────────────────────────

const STUDENT_DOCUMENTS_QUERY = gql`
  query InstituteStudentDocuments($studentProfileId: ID!) {
    listStudentDocuments(studentProfileId: $studentProfileId) {
      id
      userId
      type
      description
      fileUrls
      referenceNumber
      isVerified
      verifiedAt
      verifiedBy
      rejectionReason
      expiryDate
      createdAt
      updatedAt
    }
  }
`;

export interface StudentDocumentNode {
  id: string;
  userId: string;
  type: string;
  description?: string | null;
  fileUrls: string[];
  referenceNumber?: string | null;
  isVerified: boolean;
  verifiedAt?: string | null;
  verifiedBy?: string | null;
  rejectionReason?: string | null;
  expiryDate?: string | null;
  createdAt: string;
  updatedAt: string;
}

export function useStudentDocuments(studentProfileId: string) {
  return useQuery<{ listStudentDocuments: StudentDocumentNode[] }>(STUDENT_DOCUMENTS_QUERY, {
    variables: { studentProfileId },
    skip: !studentProfileId,
  });
}

const UPLOAD_STUDENT_DOCUMENT_MUTATION = gql`
  mutation UploadStudentDocument($input: UploadStudentDocumentInput!) {
    uploadStudentDocument(input: $input) {
      id
      userId
      type
      description
      fileUrls
      referenceNumber
      isVerified
      createdAt
      updatedAt
    }
  }
`;

export interface UploadStudentDocumentInput {
  studentProfileId: string;
  type: string;
  description?: string;
  fileUrls: string[];
  referenceNumber?: string;
}

/**
 * Mutation hook for the "Upload Document" button on the student detail
 * Documents tab (ROV-167). The client uploads file bytes directly to
 * MinIO/S3 and then calls this mutation with the resulting URLs.
 */
export function useUploadStudentDocument() {
  return useMutation<
    { uploadStudentDocument: StudentDocumentNode },
    { input: UploadStudentDocumentInput }
  >(UPLOAD_STUDENT_DOCUMENT_MUTATION, {
    refetchQueries: ['InstituteStudentDocuments'],
  });
}

// ─── TC history for a student ─────────────────────────────────────────────

const STUDENT_TCS_QUERY = gql`
  query InstituteStudentTCs($filter: ListTCFilterInput) {
    listTCs(filter: $filter) {
      id
      tcSerialNumber
      status
      reason
      isDuplicate
      originalTcId
      pdfUrl
      qrVerificationUrl
      academicYearId
      createdAt
    }
  }
`;

export interface StudentTCNode {
  id: string;
  tcSerialNumber: string;
  status: TcStatus;
  reason: string;
  isDuplicate: boolean;
  originalTcId?: string | null;
  pdfUrl?: string | null;
  qrVerificationUrl?: string | null;
  academicYearId: string;
  createdAt: string;
}

export function useStudentTCs(studentProfileId: string) {
  return useQuery<{ listTCs: StudentTCNode[] }>(STUDENT_TCS_QUERY, {
    variables: { filter: { studentProfileId } },
    skip: !studentProfileId,
  });
}

// ─── Audit log for a student ──────────────────────────────────────────────

const STUDENT_AUDIT_QUERY = gql`
  query InstituteStudentAudit($filter: AuditLogFilterInput, $first: Int) {
    auditLogs(filter: $filter, first: $first) {
      edges {
        cursor
        node {
          id
          action
          actionType
          actorId
          actorName
          userName
          changes
          correlationId
          createdAt
          entityId
          entityType
          source
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
      totalCount
    }
  }
`;

export interface StudentAuditNode {
  id: string;
  action: string;
  actionType: string;
  actorId: string;
  actorName?: string | null;
  userName?: string | null;
  changes?: Record<string, unknown> | null;
  correlationId: string;
  createdAt: string;
  entityId?: string | null;
  entityType: string;
  source: string;
}

export function useStudentAudit(studentId: string, first = 25) {
  return useQuery<{
    auditLogs: {
      edges: Array<{ cursor: string; node: StudentAuditNode }>;
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      totalCount: number;
    };
  }>(STUDENT_AUDIT_QUERY, {
    variables: {
      filter: { entityType: 'Student', entityId: studentId },
      first,
    },
    skip: !studentId,
  });
}

// ─── Sections list (for bulk section change picker) ──────────────────────

const SECTIONS_FOR_STANDARD_QUERY = gql`
  query SectionsForStandardForStudents($standardId: ID!) {
    sections(standardId: $standardId) {
      id
      name
      displayLabel
      currentStrength
    }
  }
`;

export interface SectionPickerNode {
  id: string;
  name: string;
  displayLabel?: string | null;
  currentStrength: number;
}

export function useSectionsForStandard(standardId: string | null | undefined) {
  return useQuery<{ sections: SectionPickerNode[] }>(SECTIONS_FOR_STANDARD_QUERY, {
    variables: { standardId: standardId ?? '' },
    skip: !standardId,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────

const CREATE_STUDENT = gql`
  mutation CreateInstituteStudent($input: CreateStudentInput!) {
    createStudent(input: $input) {
      id
      admissionNumber
      firstName
      lastName
      gender
      socialCategory
      academicStatus
      isRteAdmitted
      currentStandardId
      currentSectionId
      admissionDate
      createdAt
      updatedAt
      version
    }
  }
`;

/**
 * Mirrors the server `CreateStudentInput`. The backend requires
 * `firstName` (i18nText), `standardId`, `sectionId`, and `academicYearId`
 * for the initial enrollment; every other field is optional and can be
 * added later from the detail page.
 */
export interface CreateStudentMutationInput {
  firstName: Record<string, string>;
  lastName?: Record<string, string>;
  gender?: string;
  dateOfBirth?: string;
  phone?: string;
  socialCategory?: string;
  isRteAdmitted?: boolean;
  /** Standard (grade) id for initial enrollment. */
  standardId: string;
  /** Section id for initial enrollment — must belong to `standardId`. */
  sectionId: string;
  /** Academic year id — typically the active year. */
  academicYearId: string;
  admissionDate?: string;
  admissionType?: string;
  admissionClass?: string;
}

export function useCreateStudent() {
  return useMutation<
    { createStudent: Pick<StudentDetailNode, 'id'> & Record<string, unknown> },
    { input: CreateStudentMutationInput }
  >(CREATE_STUDENT, { refetchQueries: ['InstituteStudents'] });
}

const UPDATE_STUDENT = gql`
  mutation UpdateInstituteStudent($id: ID!, $input: UpdateStudentInput!) {
    updateStudent(id: $id, input: $input) {
      id
      firstName
      lastName
      gender
      dateOfBirth
      bloodGroup
      religion
      caste
      motherTongue
      socialCategory
      isRteAdmitted
      isCwsn
      cwsnType
      isMinority
      minorityType
      isBpl
      version
    }
  }
`;

const UPDATE_STUDENT_SECTION = gql`
  mutation UpdateStudentSection($input: UpdateStudentSectionInput!) {
    updateStudentSection(input: $input)
  }
`;

export interface UpdateStudentInput {
  /** Multilingual name — server accepts an i18nText jsonb (e.g. `{ en, hi }`). */
  firstName?: Record<string, string>;
  /** Multilingual surname — also i18nText jsonb. */
  lastName?: Record<string, string>;
  gender?: string;
  dateOfBirth?: string;
  bloodGroup?: string;
  religion?: string;
  caste?: string;
  motherTongue?: string;
  socialCategory?: string;
  isRteAdmitted?: boolean;
  isCwsn?: boolean;
  cwsnType?: string;
  isMinority?: boolean;
  minorityType?: string;
  isBpl?: boolean;
  /** Required by the server for optimistic concurrency. */
  version: number;
}

export function useUpdateStudent() {
  return useMutation<
    { updateStudent: StudentDetailNode },
    { id: string; input: UpdateStudentInput }
  >(UPDATE_STUDENT, { refetchQueries: ['InstituteStudents', 'InstituteStudent'] });
}

export interface UpdateStudentSectionInput {
  /** Student academic record id (current-year row), NOT the student profile id. */
  studentAcademicId: string;
  /** Target section uuid. */
  newSectionId: string;
  /** Required when overriding the section's hard capacity limit. */
  overrideReason?: string;
}

export function useUpdateStudentSection() {
  return useMutation<{ updateStudentSection: string }, { input: UpdateStudentSectionInput }>(
    UPDATE_STUDENT_SECTION,
    { refetchQueries: ['InstituteStudents'] },
  );
}

// ─── Types ────────────────────────────────────────────────────────────────

export interface StudentListNode {
  id: string;
  admissionNumber: string;
  firstName: Record<string, string>;
  lastName?: Record<string, string> | null;
  gender?: string | null;
  socialCategory: string;
  academicStatus: AcademicStatus;
  isRteAdmitted: boolean;
  /**
   * student_academics.id for the active year — present when the student
   * has a current-year enrollment row, otherwise null. Required by
   * `updateStudentSection` (bulk section change), so the list query
   * includes it to avoid an extra round-trip per row.
   */
  currentStudentAcademicId?: string | null;
  currentStandardId?: string | null;
  currentSectionId?: string | null;
  /** Denormalised standard name (from standards.name, plain text). */
  currentStandardName?: string | null;
  /** Denormalised section name (from sections.name, plain text). */
  currentSectionName?: string | null;
  /** Primary guardian's first name (i18nText), null when no primary guardian linked. */
  primaryGuardianFirstName?: Record<string, string> | null;
  primaryGuardianLastName?: Record<string, string> | null;
  admissionDate: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface StudentDetailNode extends StudentListNode {
  /** Inherited from StudentListNode but reasserted here for clarity. */
  currentStudentAcademicId?: string | null;
  dateOfBirth?: string | null;
  bloodGroup?: string | null;
  religion?: string | null;
  caste?: string | null;
  motherTongue?: string | null;
  admissionClass?: string | null;
  admissionType: string;
  currentAcademicYearId?: string | null;
  rollNumber?: string | null;
  profileImageUrl?: string | null;
  isCwsn: boolean;
  cwsnType?: string | null;
  isMinority: boolean;
  minorityType?: string | null;
  isBpl: boolean;
  previousSchoolName?: string | null;
  previousSchoolBoard?: string | null;
  tcIssued: boolean;
  tcIssuedDate?: string | null;
  tcNumber?: string | null;
  tcReason?: string | null;
  dateOfLeaving?: string | null;
  medicalInfo?: Record<string, unknown> | null;
}
