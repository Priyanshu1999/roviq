/**
 * Apollo hooks for the guardian list + detail pages (ROV-169).
 *
 * Mirrors `use-students.ts`: typed wrappers around `gql` tagged queries,
 * colocated with the page to keep query shape close to the UI that renders
 * it. Names are i18n jsonb (`Record<string, string>`) resolved on the
 * frontend via `useI18nField()` — never by the server.
 */

import { gql, useMutation, useQuery } from '@roviq/graphql';
import type {
  AuditLog,
  ConsentStatus,
  CreateGuardianInput,
  GuardianLinkedStudentModel,
  GuardianModel,
  LinkGuardianInput,
  ListGuardiansFilterInput,
  StudentModel,
  UnlinkGuardianInput,
  UpdateGuardianInput,
} from '@roviq/graphql/generated';

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

export function useUpdateGuardian() {
  return useMutation<
    { updateGuardian: GuardianDetailNode },
    { id: string; input: UpdateGuardianInput }
  >(UPDATE_GUARDIAN, { refetchQueries: ['InstituteGuardians', 'InstituteGuardian'] });
}

const LINK_GUARDIAN_TO_STUDENT = gql`
  mutation LinkGuardianToStudent($input: LinkGuardianInput!) {
    linkGuardianToStudent(input: $input) {
      id
      studentProfileId
      guardianProfileId
      relationship
      isPrimaryContact
    }
  }
`;

/**
 * Shared hook for the link-guardian-to-student mutation. Used by both the
 * guardian detail page (Children tab) and the student detail page (Guardians
 * tab). Refetches both list queries so whichever tab the user is on updates
 * in place. `awaitRefetchQueries: true` keeps the submit button in its
 * "Linking…" state until the refetch completes, so the new row is visible
 * the instant the dialog closes — no empty-for-a-frame flicker.
 */
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
    refetchQueries: ['InstituteGuardianLinkedStudents', 'InstituteStudentGuardians'],
    awaitRefetchQueries: true,
  });
}

const UNLINK_GUARDIAN_FROM_STUDENT = gql`
  mutation UnlinkGuardianFromStudent($input: UnlinkGuardianInput!) {
    unlinkGuardianFromStudent(input: $input)
  }
`;

export function useUnlinkGuardianFromStudent() {
  return useMutation<
    { unlinkGuardianFromStudent: boolean },
    { input: UnlinkGuardianMutationInput }
  >(UNLINK_GUARDIAN_FROM_STUDENT, {
    refetchQueries: ['InstituteGuardianLinkedStudents', 'InstituteStudentGuardians'],
    awaitRefetchQueries: true,
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

/**
 * Student picker for the "Link to student" dialog on the guardian detail
 * page. `skip` is honored so the underlying query does not fire while the
 * dialog is closed — the dialog mounts in the tree but stays idle until
 * the user actually opens it.
 */
export function useStudentsForGuardianPicker(search: string, options: { skip?: boolean } = {}) {
  return useQuery<{
    listStudents: { edges: Array<{ node: StudentPickerNode }> };
  }>(STUDENTS_FOR_GUARDIAN_PICKER, {
    variables: { filter: { first: 25, ...(search ? { search } : {}) } },
    skip: options.skip,
    fetchPolicy: 'cache-and-network',
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

// ─── Types (codegen-derived — single source of truth) ───────────────────────

export type GuardianListFilter = ListGuardiansFilterInput;
export type GuardianListNode = GuardianModel;
export type GuardianDetailNode = GuardianModel;
export type LinkedStudentNode = GuardianLinkedStudentModel;
export type ConsentStatusNode = ConsentStatus;
export type GuardianAuditNode = AuditLog;
// Input types — re-exported with their original alias names for backward compat
export type CreateGuardianMutationInput = CreateGuardianInput;
export type { UpdateGuardianInput };
export type LinkGuardianMutationInput = LinkGuardianInput;
export type UnlinkGuardianMutationInput = UnlinkGuardianInput;
export type StudentPickerNode = StudentModel;
