/**
 * Apollo hooks for the guardian list + detail pages (ROV-169).
 *
 * Mirrors `use-students.ts`: typed wrappers around `gql` tagged queries,
 * colocated with the page to keep query shape close to the UI that renders
 * it. Names are i18n jsonb (`Record<string, string>`) resolved on the
 * frontend via `useI18nField()` — never by the server.
 */
import { gql, useMutation, useQuery } from '@roviq/graphql';

// ─── Guardian list ────────────────────────────────────────────────────────

const GUARDIAN_LIST_FIELDS = `
  id
  userId
  firstName
  lastName
  profileImageUrl
  gender
  primaryPhone
  linkedStudentCount
  occupation
  organization
  designation
  educationLevel
  version
  createdAt
  updatedAt
`;

const GUARDIANS_LIST_QUERY = gql`
  query InstituteGuardians($filter: ListGuardiansFilterInput) {
    listGuardians(filter: $filter) {
      ${GUARDIAN_LIST_FIELDS}
    }
  }
`;

export interface GuardianListFilter {
  /** Free-text search across user_profiles.search_vector (first/last name). */
  search?: string;
}

export interface GuardianListNode {
  id: string;
  userId: string;
  firstName: Record<string, string>;
  lastName?: Record<string, string> | null;
  profileImageUrl?: string | null;
  gender?: string | null;
  /** Primary phone from phone_numbers (is_primary=true). Null if none on file. */
  primaryPhone?: string | null;
  /** Count of students linked via student_guardian_links; always a number (>= 0). */
  linkedStudentCount: number;
  occupation?: string | null;
  organization?: string | null;
  designation?: string | null;
  educationLevel?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export function useGuardians(filter?: GuardianListFilter) {
  return useQuery<{ listGuardians: GuardianListNode[] }>(GUARDIANS_LIST_QUERY, {
    variables: { filter: filter ?? {} },
    notifyOnNetworkStatusChange: true,
  });
}

// ─── Guardian detail ──────────────────────────────────────────────────────

const GUARDIAN_DETAIL_QUERY = gql`
  query InstituteGuardian($id: ID!) {
    getGuardian(id: $id) {
      ${GUARDIAN_LIST_FIELDS}
      membershipId
    }
  }
`;

export interface GuardianDetailNode extends GuardianListNode {
  membershipId: string;
}

export function useGuardian(id: string) {
  return useQuery<{ getGuardian: GuardianDetailNode }>(GUARDIAN_DETAIL_QUERY, {
    variables: { id },
    skip: !id,
  });
}

// ─── Linked children (guardian → students) ───────────────────────────────

const GUARDIAN_LINKED_STUDENTS_QUERY = gql`
  query InstituteGuardianLinkedStudents($guardianProfileId: ID!) {
    listLinkedStudents(guardianProfileId: $guardianProfileId) {
      linkId
      studentProfileId
      firstName
      lastName
      admissionNumber
      currentStandardName
      currentSectionName
      profileImageUrl
      relationship
      isPrimaryContact
      isEmergencyContact
      canPickup
      livesWith
    }
  }
`;

export interface LinkedStudentNode {
  linkId: string;
  studentProfileId: string;
  firstName: Record<string, string>;
  lastName?: Record<string, string> | null;
  admissionNumber: string;
  currentStandardName?: Record<string, string> | null;
  currentSectionName?: Record<string, string> | null;
  profileImageUrl?: string | null;
  relationship: string;
  isPrimaryContact: boolean;
  isEmergencyContact: boolean;
  canPickup: boolean;
  livesWith: boolean;
}

export function useGuardianLinkedStudents(guardianProfileId: string) {
  return useQuery<{ listLinkedStudents: LinkedStudentNode[] }>(GUARDIAN_LINKED_STUDENTS_QUERY, {
    variables: { guardianProfileId },
    skip: !guardianProfileId,
  });
}

// ─── Consent status per student (for guardian detail Children tab) ──────

const CONSENT_STATUS_FOR_STUDENT_QUERY = gql`
  query ConsentStatusForStudent($studentProfileId: ID!) {
    consentStatusForStudent(studentProfileId: $studentProfileId) {
      studentProfileId
      purpose
      isGranted
      lastUpdatedAt
    }
  }
`;

export interface ConsentStatusNode {
  studentProfileId: string;
  purpose: string;
  isGranted: boolean;
  lastUpdatedAt?: string | null;
}

export function useConsentStatusForStudent(studentProfileId: string) {
  return useQuery<{ consentStatusForStudent: ConsentStatusNode[] }>(
    CONSENT_STATUS_FOR_STUDENT_QUERY,
    {
      variables: { studentProfileId },
      skip: !studentProfileId,
    },
  );
}

// ─── Mutations ────────────────────────────────────────────────────────────

const CREATE_GUARDIAN = gql`
  mutation CreateInstituteGuardian($input: CreateGuardianInput!) {
    createGuardian(input: $input) {
      ${GUARDIAN_LIST_FIELDS}
    }
  }
`;

/**
 * Mirrors the server `CreateGuardianInput`. `firstName` is the only
 * required field; every other field is optional. When
 * `studentProfileId` + `relationship` are both provided the backend
 * creates the guardian AND immediately links them to the student.
 */
export interface CreateGuardianMutationInput {
  firstName: Record<string, string>;
  lastName?: Record<string, string>;
  gender?: string;
  phone?: string;
  email?: string;
  occupation?: string;
  organization?: string;
  educationLevel?: string;
  /** Optional — when set the guardian is immediately linked to this student. */
  studentProfileId?: string;
  /** Required only when `studentProfileId` is provided. */
  relationship?: string;
  isPrimaryContact?: boolean;
}

export function useCreateGuardian() {
  return useMutation<{ createGuardian: GuardianListNode }, { input: CreateGuardianMutationInput }>(
    CREATE_GUARDIAN,
    {
      refetchQueries: ['InstituteGuardians'],
    },
  );
}

const UPDATE_GUARDIAN = gql`
  mutation UpdateInstituteGuardian($id: ID!, $input: UpdateGuardianInput!) {
    updateGuardian(id: $id, input: $input) {
      id
      occupation
      organization
      designation
      educationLevel
      version
    }
  }
`;

export interface UpdateGuardianInput {
  occupation?: string;
  organization?: string;
  designation?: string;
  educationLevel?: string;
  /** Required by the server for optimistic concurrency. */
  version: number;
}

export function useUpdateGuardian() {
  return useMutation<
    { updateGuardian: GuardianDetailNode },
    { id: string; input: UpdateGuardianInput }
  >(UPDATE_GUARDIAN, { refetchQueries: ['InstituteGuardians', 'InstituteGuardian'] });
}

const LINK_GUARDIAN_TO_STUDENT = gql`
  mutation LinkGuardianToStudentFromGuardianPage($input: LinkGuardianInput!) {
    linkGuardianToStudent(input: $input) {
      id
      studentProfileId
      guardianProfileId
      relationship
      isPrimaryContact
    }
  }
`;

export interface LinkGuardianMutationInput {
  guardianProfileId: string;
  studentProfileId: string;
  relationship: string;
  isPrimaryContact?: boolean;
  isEmergencyContact?: boolean;
  canPickup?: boolean;
  livesWith?: boolean;
}

export function useLinkGuardianToStudent() {
  return useMutation<
    {
      linkGuardianToStudent: {
        id: string;
        studentProfileId: string;
        guardianProfileId: string;
        relationship: string;
        isPrimaryContact: boolean;
      };
    },
    { input: LinkGuardianMutationInput }
  >(LINK_GUARDIAN_TO_STUDENT, {
    refetchQueries: ['InstituteGuardianLinkedStudents'],
  });
}

const UNLINK_GUARDIAN_FROM_STUDENT = gql`
  mutation UnlinkGuardianFromStudentFromGuardianPage($input: UnlinkGuardianInput!) {
    unlinkGuardianFromStudent(input: $input)
  }
`;

export interface UnlinkGuardianMutationInput {
  guardianProfileId: string;
  studentProfileId: string;
  /** Required when unlinking a primary contact — assigns this guardian as new primary. */
  newPrimaryGuardianId?: string;
}

export function useUnlinkGuardianFromStudent() {
  return useMutation<
    { unlinkGuardianFromStudent: boolean },
    { input: UnlinkGuardianMutationInput }
  >(UNLINK_GUARDIAN_FROM_STUDENT, {
    refetchQueries: ['InstituteGuardianLinkedStudents'],
  });
}

// ─── Student picker (for "Link to student" dialog) ───────────────────────

const STUDENTS_FOR_GUARDIAN_PICKER = gql`
  query StudentsForGuardianPicker($filter: StudentFilterInput) {
    listStudents(filter: $filter) {
      edges {
        node {
          id
          admissionNumber
          firstName
          lastName
          currentStandardName
          currentSectionName
        }
      }
    }
  }
`;

export interface StudentPickerNode {
  id: string;
  admissionNumber: string;
  firstName: Record<string, string>;
  lastName?: Record<string, string> | null;
  currentStandardName?: string | null;
  currentSectionName?: string | null;
}

export function useStudentsForGuardianPicker(search: string) {
  return useQuery<{
    listStudents: { edges: Array<{ node: StudentPickerNode }> };
  }>(STUDENTS_FOR_GUARDIAN_PICKER, {
    variables: { filter: { first: 25, ...(search ? { search } : {}) } },
  });
}

// ─── Audit log for a guardian ────────────────────────────────────────────

const GUARDIAN_AUDIT_QUERY = gql`
  query InstituteGuardianAudit($filter: AuditLogFilterInput, $first: Int) {
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

export interface GuardianAuditNode {
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

export function useGuardianAudit(guardianId: string, first = 25) {
  return useQuery<{
    auditLogs: {
      edges: Array<{ cursor: string; node: GuardianAuditNode }>;
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      totalCount: number;
    };
  }>(GUARDIAN_AUDIT_QUERY, {
    variables: {
      filter: { entityType: 'Guardian', entityId: guardianId },
      first,
    },
    skip: !guardianId,
  });
}
