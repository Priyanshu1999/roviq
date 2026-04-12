import { gql, useLazyQuery, useMutation, useQuery, useSubscription } from '@roviq/graphql';
import type {
  AcademicYearModel,
  AuditLog,
  CreateStudentInput,
  SectionModel,
  StandardModel,
  StudentAcademicHistoryModel,
  StudentDocumentModel,
  StudentFilterInput,
  StudentGuardianModel,
  StudentModel,
  TcModel,
  UpdateStudentInput,
  UpdateStudentSectionInput,
  UploadStudentDocumentInput,
} from '@roviq/graphql/generated';

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
      medicalInfo { allergies conditions medications emergency_contact { name phone relationship } }
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

export function useCreateStudent() {
  return useMutation<
    { createStudent: Pick<StudentDetailNode, 'id'> & Record<string, unknown> },
    { input: CreateStudentInput }
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

export function useUpdateStudent() {
  return useMutation<
    { updateStudent: StudentDetailNode },
    { id: string; input: UpdateStudentInput }
  >(UPDATE_STUDENT, { refetchQueries: ['InstituteStudents', 'InstituteStudent'] });
}

export function useUpdateStudentSection() {
  return useMutation<{ updateStudentSection: string }, { input: UpdateStudentSectionInput }>(
    UPDATE_STUDENT_SECTION,
    { refetchQueries: ['InstituteStudents'] },
  );
}

// ─── Types ────────────────────────────────────────────────────────────────

/**
 * Filter input passed to listStudents — mirrors the generated StudentFilterInput
 * but re-exported from here so pages only import from use-students.
 */
export type StudentListFilter = StudentFilterInput;

/**
 * Slim standard row returned by standardsForStudentsList — only the fields
 * selected in STANDARDS_BY_YEAR_QUERY.
 */
export type StandardPickerNode = Pick<StandardModel, 'id' | 'name' | 'numericOrder'>;

/**
 * Slim academic-year row returned by academicYearsForStudentsList — only the
 * fields selected in ACADEMIC_YEARS_QUERY.
 */
export type AcademicYearNode = Pick<
  AcademicYearModel,
  'id' | 'label' | 'isActive' | 'startDate' | 'endDate'
>;

/**
 * One row from listStudentAcademics — mirrors StudentAcademicHistoryModel but
 * aliased here so the hook's return type is self-contained.
 */
export type StudentAcademicHistoryNode = StudentAcademicHistoryModel;

/**
 * Guardian row returned by listStudentGuardians — mirrors StudentGuardianModel.
 */
export type StudentGuardianNode = StudentGuardianModel;

/**
 * Document row returned by listStudentDocuments / uploadStudentDocument.
 */
export type StudentDocumentNode = StudentDocumentModel;

/**
 * TC row returned by listTCs — only the fields selected in STUDENT_TCS_QUERY.
 */
export type StudentTCNode = Pick<
  TcModel,
  | 'id'
  | 'tcSerialNumber'
  | 'status'
  | 'reason'
  | 'isDuplicate'
  | 'originalTcId'
  | 'pdfUrl'
  | 'qrVerificationUrl'
  | 'academicYearId'
  | 'createdAt'
>;

/**
 * One audit-log node returned inside the auditLogs connection — mirrors the
 * fields selected in STUDENT_AUDIT_QUERY.
 */
export type StudentAuditNode = Pick<
  AuditLog,
  | 'id'
  | 'action'
  | 'actionType'
  | 'actorId'
  | 'actorName'
  | 'userName'
  | 'changes'
  | 'correlationId'
  | 'createdAt'
  | 'entityId'
  | 'entityType'
  | 'source'
>;

/**
 * Slim section row returned by sectionsForStandardForStudents — only the
 * fields selected in SECTIONS_FOR_STANDARD_QUERY.
 */
export type SectionPickerNode = Pick<
  SectionModel,
  'id' | 'name' | 'displayLabel' | 'currentStrength'
>;

export type StudentListNode = StudentModel;
export type StudentDetailNode = StudentModel;
