/**
 * Apollo hooks for the staff feature (list + detail + qualifications).
 *
 * StaffModel.firstName / lastName come back from the API as `i18nText`
 * (jsonb) objects — the backend does NOT resolve a locale for us, so
 * hooks consumers must pass the value through `useI18nField()` before
 * rendering (see `.claude/rules/i18n-essentials.md`).
 */
import { gql, useMutation, useQuery } from '@roviq/graphql';

// ─── List ────────────────────────────────────────────────────────────────

const STAFF_LIST_FIELDS = `
  id
  userId
  membershipId
  firstName
  lastName
  gender
  profileImageUrl
  employeeId
  designation
  department
  dateOfJoining
  dateOfLeaving
  employmentType
  isClassTeacher
  socialCategory
  specialization
  createdAt
  updatedAt
  version
`;

const STAFF_LIST_QUERY = gql`
  query InstituteStaff($filter: ListStaffFilterInput) {
    listStaff(filter: $filter) {
      ${STAFF_LIST_FIELDS}
    }
  }
`;

/**
 * Filter shape mirroring `ListStaffFilterInput` on the backend — only the
 * subset exposed on the list toolbar is surfaced here. Matches the server
 * field names exactly so it can be passed straight to Apollo.
 */
export interface StaffListFilter {
  search?: string;
  department?: string;
  designation?: string;
  employmentType?: string;
  isClassTeacher?: boolean;
  /** Page size — forwarded to backend `first`. */
  first?: number;
}

export function useStaff(filter?: StaffListFilter) {
  const { data, loading, refetch } = useQuery<{ listStaff: StaffListNode[] }>(STAFF_LIST_QUERY, {
    variables: { filter: { first: 25, ...filter } },
    notifyOnNetworkStatusChange: true,
  });
  return {
    staff: data?.listStaff ?? [],
    loading,
    refetch,
  };
}

// ─── Detail ──────────────────────────────────────────────────────────────

const STAFF_DETAIL_QUERY = gql`
  query InstituteStaffMember($id: ID!) {
    getStaffMember(id: $id) {
      ${STAFF_LIST_FIELDS}
      dateOfBirth
    }
  }
`;

export function useStaffMember(id: string) {
  return useQuery<{ getStaffMember: StaffDetailNode }>(STAFF_DETAIL_QUERY, {
    variables: { id },
    skip: !id,
  });
}

// ─── Staff create mutation ───────────────────────────────────────────────

const CREATE_STAFF = gql`
  mutation CreateInstituteStaffMember($input: CreateStaffInput!) {
    createStaffMember(input: $input) {
      ${STAFF_LIST_FIELDS}
      dateOfBirth
    }
  }
`;

/**
 * Mirrors the server `CreateStaffInput`. `firstName` is required i18nText;
 * every other field is optional so the form can be submitted with a
 * minimal personal + employment footprint and enriched later on the
 * detail page.
 */
export interface CreateStaffMemberInput {
  /** i18nText jsonb (e.g. `{ en, hi }`) — must contain at least `en`. */
  firstName: Record<string, string>;
  /** i18nText jsonb — optional. */
  lastName?: Record<string, string>;
  gender?: string;
  dateOfBirth?: string;
  email?: string;
  /** 10-digit Indian mobile, without +91. */
  phone?: string;
  designation?: string;
  department?: string;
  /** ISO date string (YYYY-MM-DD). */
  dateOfJoining?: string;
  employmentType?: string;
  specialization?: string;
}

export function useCreateStaffMember() {
  return useMutation<{ createStaffMember: StaffDetailNode }, { input: CreateStaffMemberInput }>(
    CREATE_STAFF,
    {
      refetchQueries: ['InstituteStaff'],
    },
  );
}

// ─── Staff update mutation ───────────────────────────────────────────────

const UPDATE_STAFF = gql`
  mutation UpdateInstituteStaffMember($id: ID!, $input: UpdateStaffInput!) {
    updateStaffMember(id: $id, input: $input) {
      ${STAFF_LIST_FIELDS}
    }
  }
`;

/**
 * Subset of `UpdateStaffInput` from the backend — only fields that the
 * profile tab edits. `version` is required for optimistic concurrency.
 */
export interface UpdateStaffMemberInput {
  designation?: string;
  department?: string;
  employmentType?: string;
  isClassTeacher?: boolean;
  specialization?: string;
  socialCategory?: string;
  /** Server requires the current version for the compare-and-swap update. */
  version: number;
}

export function useUpdateStaffMember() {
  return useMutation<
    { updateStaffMember: StaffDetailNode },
    { id: string; input: UpdateStaffMemberInput }
  >(UPDATE_STAFF, {
    refetchQueries: ['InstituteStaff', 'InstituteStaffMember'],
  });
}

// ─── Qualifications ──────────────────────────────────────────────────────

const STAFF_QUALIFICATIONS_QUERY = gql`
  query InstituteStaffQualifications($staffProfileId: ID!) {
    listStaffQualifications(staffProfileId: $staffProfileId) {
      id
      staffProfileId
      type
      degreeName
      institution
      boardUniversity
      yearOfPassing
      gradePercentage
      certificateUrl
      createdAt
    }
  }
`;

export function useStaffQualifications(staffProfileId: string) {
  return useQuery<{ listStaffQualifications: StaffQualificationNode[] }>(
    STAFF_QUALIFICATIONS_QUERY,
    {
      variables: { staffProfileId },
      skip: !staffProfileId,
    },
  );
}

const CREATE_STAFF_QUALIFICATION = gql`
  mutation CreateStaffQualification($input: CreateStaffQualificationInput!) {
    createStaffQualification(input: $input) {
      id
      staffProfileId
      type
      degreeName
      institution
      boardUniversity
      yearOfPassing
      gradePercentage
      certificateUrl
      createdAt
    }
  }
`;

export interface CreateStaffQualificationInput {
  staffProfileId: string;
  /** `academic` or `professional`. */
  type: 'ACADEMIC' | 'PROFESSIONAL';
  degreeName: string;
  institution?: string;
  boardUniversity?: string;
  yearOfPassing?: number;
  gradePercentage?: string;
  certificateUrl?: string;
}

export function useCreateStaffQualification() {
  return useMutation<
    { createStaffQualification: StaffQualificationNode },
    { input: CreateStaffQualificationInput }
  >(CREATE_STAFF_QUALIFICATION, {
    refetchQueries: ['InstituteStaffQualifications'],
  });
}

const UPDATE_STAFF_QUALIFICATION = gql`
  mutation UpdateStaffQualification($id: ID!, $input: UpdateStaffQualificationInput!) {
    updateStaffQualification(id: $id, input: $input) {
      id
      staffProfileId
      type
      degreeName
      institution
      boardUniversity
      yearOfPassing
      gradePercentage
      certificateUrl
      createdAt
    }
  }
`;

export interface UpdateStaffQualificationInput {
  type?: 'ACADEMIC' | 'PROFESSIONAL';
  degreeName?: string;
  institution?: string;
  boardUniversity?: string;
  yearOfPassing?: number;
  gradePercentage?: string;
  certificateUrl?: string;
}

export function useUpdateStaffQualification() {
  return useMutation<
    { updateStaffQualification: StaffQualificationNode },
    { id: string; input: UpdateStaffQualificationInput }
  >(UPDATE_STAFF_QUALIFICATION, {
    refetchQueries: ['InstituteStaffQualifications'],
  });
}

const DELETE_STAFF_QUALIFICATION = gql`
  mutation DeleteStaffQualification($id: ID!) {
    deleteStaffQualification(id: $id)
  }
`;

export function useDeleteStaffQualification() {
  return useMutation<{ deleteStaffQualification: boolean }, { id: string }>(
    DELETE_STAFF_QUALIFICATION,
    { refetchQueries: ['InstituteStaffQualifications'] },
  );
}

// ─── Types ────────────────────────────────────────────────────────────────

/**
 * Row shape for the staff list table. `firstName`/`lastName` are i18nText
 * jsonb — always resolve via `useI18nField()` before rendering.
 */
export interface StaffListNode {
  id: string;
  userId: string;
  membershipId: string;
  firstName: Record<string, string>;
  lastName?: Record<string, string> | null;
  gender?: string | null;
  profileImageUrl?: string | null;
  employeeId?: string | null;
  designation?: string | null;
  department?: string | null;
  dateOfJoining?: string | null;
  dateOfLeaving?: string | null;
  employmentType?: string | null;
  isClassTeacher: boolean;
  socialCategory?: string | null;
  specialization?: string | null;
  createdAt: string;
  updatedAt: string;
  /** Row version — used for optimistic concurrency on `updateStaffMember`. */
  version: number;
}

export interface StaffDetailNode extends StaffListNode {
  dateOfBirth?: string | null;
}

export interface StaffQualificationNode {
  id: string;
  staffProfileId: string;
  type: string;
  degreeName: string;
  institution?: string | null;
  boardUniversity?: string | null;
  yearOfPassing?: number | null;
  gradePercentage?: string | null;
  certificateUrl?: string | null;
  createdAt: string;
}
