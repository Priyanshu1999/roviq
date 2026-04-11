/**
 * Apollo hooks for the staff feature (list + detail + qualifications).
 *
 * StaffModel.firstName / lastName come back from the API as `i18nText`
 * (jsonb) objects — the backend does NOT resolve a locale for us, so
 * hooks consumers must pass the value through `useI18nField()` before
 * rendering (see `.claude/rules/i18n-essentials.md`).
 */
import { gql, useMutation, useQuery } from '@roviq/graphql';
import type {
  CreateStaffInput,
  CreateStaffQualificationInput,
  ListStaffFilterInput,
  StaffModel,
  StaffQualificationModel,
  UpdateStaffInput,
  UpdateStaffQualificationInput,
} from '@roviq/graphql/generated';

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

// ─── Types (codegen-derived — single source of truth) ───────────────────────

export type StaffListFilter = ListStaffFilterInput;
export type StaffListNode = StaffModel;
export type StaffDetailNode = StaffModel;
export type StaffQualificationNode = StaffQualificationModel;
// Input types — re-exported with alias names for backward compat
export type CreateStaffMemberInput = CreateStaffInput;
export type UpdateStaffMemberInput = UpdateStaffInput;
export type { CreateStaffQualificationInput, UpdateStaffQualificationInput };
