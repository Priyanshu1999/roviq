'use client';

import { gql, useMutation, useQuery } from '@roviq/graphql';

// ── Standards ──

const STANDARDS_QUERY = gql`
  query Standards($academicYearId: ID!) {
    standards(academicYearId: $academicYearId) {
      id
      name
      numericOrder
      level
      nepStage
      department
      isBoardExamClass
      streamApplicable
      maxSectionsAllowed
      maxStudentsPerSection
      udiseClassCode
      createdAt
    }
  }
`;

const CREATE_STANDARD = gql`
  mutation CreateStandard($input: CreateStandardInput!) {
    createStandard(input: $input) {
      id
      name
      numericOrder
      level
      department
    }
  }
`;

const UPDATE_STANDARD = gql`
  mutation UpdateStandard($id: ID!, $input: UpdateStandardInput!) {
    updateStandard(id: $id, input: $input) {
      id
      name
      numericOrder
      level
      department
    }
  }
`;

const DELETE_STANDARD = gql`
  mutation DeleteStandard($id: ID!) {
    deleteStandard(id: $id)
  }
`;

// ── Sections ──

const SECTIONS_QUERY = gql`
  query Sections($standardId: ID!) {
    sections(standardId: $standardId) {
      id
      name
      displayLabel
      stream
      mediumOfInstruction
      shift
      classTeacherId
      room
      capacity
      currentStrength
      genderRestriction
      displayOrder
      startTime
      endTime
      batchStatus
    }
  }
`;

const CREATE_SECTION = gql`
  mutation CreateSection($input: CreateSectionInput!) {
    createSection(input: $input) {
      id
      name
      displayLabel
      stream
      capacity
      currentStrength
    }
  }
`;

const DELETE_SECTION = gql`
  mutation DeleteSection($id: ID!) {
    deleteSection(id: $id)
  }
`;

// ── Subjects ──

const SUBJECTS_BY_STANDARD_QUERY = gql`
  query SubjectsByStandard($standardId: ID!) {
    subjectsByStandard(standardId: $standardId) {
      id
      name
      shortName
      boardCode
      type
      isMandatory
      hasPractical
      theoryMarks
      practicalMarks
      internalMarks
      isElective
      electiveGroup
    }
  }
`;

const CREATE_SUBJECT = gql`
  mutation CreateSubject($input: CreateSubjectInput!) {
    createSubject(input: $input) {
      id
      name
      shortName
      boardCode
      type
    }
  }
`;

const DELETE_SUBJECT = gql`
  mutation DeleteSubject($id: ID!) {
    deleteSubject(id: $id)
  }
`;

const ASSIGN_SUBJECT_TO_STANDARD = gql`
  mutation AssignSubjectToStandard($subjectId: ID!, $standardId: ID!) {
    assignSubjectToStandard(subjectId: $subjectId, standardId: $standardId)
  }
`;

// ── Types ──

export interface Standard {
  id: string;
  name: string;
  numericOrder: number;
  level: string | null;
  nepStage: string | null;
  department: string | null;
  isBoardExamClass: boolean;
  streamApplicable: boolean;
  maxSectionsAllowed: number | null;
  maxStudentsPerSection: number | null;
  udiseClassCode: number | null;
  createdAt: string;
}

export interface Section {
  id: string;
  name: string;
  displayLabel: string | null;
  stream: { name: string; code: string } | null;
  mediumOfInstruction: string | null;
  shift: string | null;
  classTeacherId: string | null;
  room: string | null;
  capacity: number | null;
  currentStrength: number;
  genderRestriction: string;
  displayOrder: number;
  startTime: string | null;
  endTime: string | null;
  batchStatus: string | null;
}

export interface Subject {
  id: string;
  name: string;
  shortName: string | null;
  boardCode: string | null;
  type: string;
  isMandatory: boolean;
  hasPractical: boolean;
  theoryMarks: number | null;
  practicalMarks: number | null;
  internalMarks: number | null;
  isElective: boolean;
  electiveGroup: string | null;
}

// ── Hooks ──

export function useStandards(academicYearId: string | null) {
  const { data, loading, error, refetch } = useQuery<{
    standards: Standard[];
  }>(STANDARDS_QUERY, {
    variables: { academicYearId },
    skip: !academicYearId,
  });
  return { standards: data?.standards ?? [], loading, error, refetch };
}

export function useCreateStandard() {
  const [mutate, { loading }] = useMutation(CREATE_STANDARD, {
    refetchQueries: ['Standards'],
  });
  return {
    createStandard: (input: Record<string, unknown>) => mutate({ variables: { input } }),
    loading,
  };
}

export function useUpdateStandard() {
  const [mutate, { loading }] = useMutation(UPDATE_STANDARD, {
    refetchQueries: ['Standards'],
  });
  return {
    updateStandard: (id: string, input: Record<string, unknown>) =>
      mutate({ variables: { id, input } }),
    loading,
  };
}

export function useDeleteStandard() {
  const [mutate, { loading }] = useMutation(DELETE_STANDARD, {
    refetchQueries: ['Standards'],
  });
  return {
    deleteStandard: (id: string) => mutate({ variables: { id } }),
    loading,
  };
}

export function useSections(standardId: string | null) {
  const { data, loading, error, refetch } = useQuery<{
    sections: Section[];
  }>(SECTIONS_QUERY, {
    variables: { standardId },
    skip: !standardId,
    pollInterval: 30000, // Poll every 30 seconds for strength changes
  });
  return { sections: data?.sections ?? [], loading, error, refetch };
}

export function useCreateSection() {
  const [mutate, { loading }] = useMutation(CREATE_SECTION, {
    refetchQueries: ['Sections'],
  });
  return {
    createSection: (input: Record<string, unknown>) => mutate({ variables: { input } }),
    loading,
  };
}

export function useDeleteSection() {
  const [mutate, { loading }] = useMutation(DELETE_SECTION, {
    refetchQueries: ['Sections'],
  });
  return {
    deleteSection: (id: string) => mutate({ variables: { id } }),
    loading,
  };
}

export function useSubjectsByStandard(standardId: string | null) {
  const { data, loading, error, refetch } = useQuery<{
    subjectsByStandard: Subject[];
  }>(SUBJECTS_BY_STANDARD_QUERY, {
    variables: { standardId },
    skip: !standardId,
  });
  return { subjects: data?.subjectsByStandard ?? [], loading, error, refetch };
}

export function useCreateSubject() {
  const [mutate, { loading }] = useMutation(CREATE_SUBJECT, {
    refetchQueries: ['SubjectsByStandard'],
  });
  return {
    createSubject: (input: Record<string, unknown>) => mutate({ variables: { input } }),
    loading,
  };
}

export function useDeleteSubject() {
  const [mutate, { loading }] = useMutation(DELETE_SUBJECT, {
    refetchQueries: ['SubjectsByStandard'],
  });
  return {
    deleteSubject: (id: string) => mutate({ variables: { id } }),
    loading,
  };
}

export function useAssignSubjectToStandard() {
  const [mutate, { loading }] = useMutation(ASSIGN_SUBJECT_TO_STANDARD, {
    refetchQueries: ['SubjectsByStandard'],
  });
  return {
    assignToStandard: (subjectId: string, standardId: string) =>
      mutate({ variables: { subjectId, standardId } }),
    loading,
  };
}
