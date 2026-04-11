'use client';

import { gql, useMutation, useQuery } from '@roviq/graphql';
import type { AcademicYearModel } from '@roviq/graphql/generated';

const ACADEMIC_YEARS_QUERY = gql`
  query AcademicYears {
    academicYears {
      id
      label
      startDate
      endDate
      isActive
      status
      termStructure { label startDate endDate }
      boardExamDates
      createdAt
      updatedAt
    }
  }
`;

const ACTIVE_ACADEMIC_YEAR_QUERY = gql`
  query ActiveAcademicYear {
    activeAcademicYear {
      id
      label
      status
    }
  }
`;

const CREATE_ACADEMIC_YEAR = gql`
  mutation CreateAcademicYear($input: CreateAcademicYearInput!) {
    createAcademicYear(input: $input) {
      id
      label
      startDate
      endDate
      isActive
      status
      termStructure { label startDate endDate }
    }
  }
`;

const ACTIVATE_ACADEMIC_YEAR = gql`
  mutation ActivateAcademicYear($id: ID!) {
    activateAcademicYear(id: $id) {
      id
      label
      isActive
      status
    }
  }
`;

const ARCHIVE_ACADEMIC_YEAR = gql`
  mutation ArchiveAcademicYear($id: ID!) {
    archiveAcademicYear(id: $id) {
      id
      label
      isActive
      status
    }
  }
`;

const DELETE_ACADEMIC_YEAR = gql`
  mutation DeleteAcademicYear($id: ID!) {
    deleteAcademicYear(id: $id)
  }
`;

export type AcademicYear = AcademicYearModel;

export function useAcademicYears() {
  const { data, loading, error, refetch } = useQuery<{ academicYears: AcademicYear[] }>(
    ACADEMIC_YEARS_QUERY,
  );

  return {
    years: data?.academicYears ?? [],
    loading,
    error,
    refetch,
  };
}

export function useActiveAcademicYear() {
  const { data, loading } = useQuery<{
    activeAcademicYear: { id: string; label: string; status: string } | null;
  }>(ACTIVE_ACADEMIC_YEAR_QUERY);

  return {
    activeYear: data?.activeAcademicYear ?? null,
    loading,
  };
}

export function useCreateAcademicYear() {
  const [mutate, { loading }] = useMutation(CREATE_ACADEMIC_YEAR, {
    refetchQueries: ['AcademicYears', 'ActiveAcademicYear'],
  });

  return {
    createYear: (input: {
      label: string;
      startDate: string;
      endDate: string;
      termStructure?: Array<{ label: string; startDate: string; endDate: string }>;
    }) => mutate({ variables: { input } }),
    loading,
  };
}

export function useActivateAcademicYear() {
  const [mutate, { loading }] = useMutation(ACTIVATE_ACADEMIC_YEAR, {
    refetchQueries: ['AcademicYears', 'ActiveAcademicYear'],
  });

  return {
    activateYear: (id: string) => mutate({ variables: { id } }),
    loading,
  };
}

export function useArchiveAcademicYear() {
  const [mutate, { loading }] = useMutation(ARCHIVE_ACADEMIC_YEAR, {
    refetchQueries: ['AcademicYears', 'ActiveAcademicYear'],
  });

  return {
    archiveYear: (id: string) => mutate({ variables: { id } }),
    loading,
  };
}

export function useDeleteAcademicYear() {
  const [mutate, { loading }] = useMutation(DELETE_ACADEMIC_YEAR, {
    refetchQueries: ['AcademicYears', 'ActiveAcademicYear'],
  });

  return {
    deleteYear: (id: string) => mutate({ variables: { id } }),
    loading,
  };
}
