'use client';

import { HOLIDAY_TYPE_VALUES } from '@roviq/common-types';
import { gql, useMutation, useQuery } from '@roviq/graphql';
import type {
  CreateHolidayInput,
  HolidayModel,
  HolidayType,
  UpdateHolidayInput,
} from '@roviq/graphql/generated';

export type { HolidayType, CreateHolidayInput };
export type HolidayRecord = HolidayModel;
export type UpdateHolidayPayload = UpdateHolidayInput;
export { HOLIDAY_TYPE_VALUES };

export interface HolidayListFilter {
  type?: HolidayType | null;
  startDate?: string | null;
  endDate?: string | null;
  isPublic?: boolean | null;
}

// ─── Fragments / queries ──────────────────────────────────────────────
//
// The codegen pipeline has not yet emitted typed documents for
// holidays, so we use raw `gql` with hand-written return shapes. Once
// Tilt regenerates the schema the ambient types can replace these —
// the field selection matches `HolidayModel` 1:1 so the migration is
// mechanical.

const HOLIDAY_FIELDS = `
  id
  name
  description
  type
  startDate
  endDate
  tags
  isPublic
  createdAt
  updatedAt
`;

const HOLIDAYS_QUERY = gql`
  query Holidays(
    $type: HolidayType
    $startDate: String
    $endDate: String
    $isPublic: Boolean
  ) {
    holidays(
      type: $type
      startDate: $startDate
      endDate: $endDate
      isPublic: $isPublic
    ) {
      ${HOLIDAY_FIELDS}
    }
  }
`;

const HOLIDAY_QUERY = gql`
  query Holiday($id: ID!) {
    holiday(id: $id) {
      ${HOLIDAY_FIELDS}
    }
  }
`;

const HOLIDAYS_ON_DATE_QUERY = gql`
  query HolidaysOnDate($date: String!) {
    holidaysOnDate(date: $date) {
      ${HOLIDAY_FIELDS}
    }
  }
`;

const CREATE_HOLIDAY = gql`
  mutation CreateHoliday($input: CreateHolidayInput!) {
    createHoliday(input: $input) {
      ${HOLIDAY_FIELDS}
    }
  }
`;

const UPDATE_HOLIDAY = gql`
  mutation UpdateHoliday($id: ID!, $input: UpdateHolidayInput!) {
    updateHoliday(id: $id, input: $input) {
      ${HOLIDAY_FIELDS}
    }
  }
`;

const DELETE_HOLIDAY = gql`
  mutation DeleteHoliday($id: ID!) {
    deleteHoliday(id: $id)
  }
`;

// ─── Query hooks ──────────────────────────────────────────────────────

export function useHolidays(filter: HolidayListFilter = {}) {
  const { data, loading, error, refetch } = useQuery<{ holidays: HolidayRecord[] }>(
    HOLIDAYS_QUERY,
    {
      variables: {
        type: filter.type ?? null,
        startDate: filter.startDate ?? null,
        endDate: filter.endDate ?? null,
        isPublic: filter.isPublic ?? null,
      },
      fetchPolicy: 'cache-and-network',
    },
  );
  return {
    holidays: data?.holidays ?? [],
    loading,
    error,
    refetch,
  };
}

export function useHoliday(id: string | null) {
  const { data, loading, error, refetch } = useQuery<{ holiday: HolidayRecord }>(HOLIDAY_QUERY, {
    variables: { id },
    skip: !id,
    fetchPolicy: 'cache-and-network',
  });
  return {
    holiday: data?.holiday ?? null,
    loading,
    error,
    refetch,
  };
}

export function useHolidaysOnDate(date: string | null) {
  const { data, loading, error, refetch } = useQuery<{ holidaysOnDate: HolidayRecord[] }>(
    HOLIDAYS_ON_DATE_QUERY,
    {
      variables: { date },
      skip: !date,
      fetchPolicy: 'cache-and-network',
    },
  );
  return {
    holidays: data?.holidaysOnDate ?? [],
    loading,
    error,
    refetch,
  };
}

// ─── Mutation hooks ───────────────────────────────────────────────────

export function useCreateHoliday() {
  const [mutate, { loading }] = useMutation<
    { createHoliday: HolidayRecord },
    { input: CreateHolidayInput }
  >(CREATE_HOLIDAY, { refetchQueries: ['Holidays'] });
  return {
    mutate: (input: CreateHolidayInput) => mutate({ variables: { input } }),
    loading,
  };
}

export function useUpdateHoliday() {
  const [mutate, { loading }] = useMutation<
    { updateHoliday: HolidayRecord },
    { id: string; input: UpdateHolidayPayload }
  >(UPDATE_HOLIDAY, { refetchQueries: ['Holidays', 'Holiday'] });
  return {
    mutate: (id: string, input: UpdateHolidayPayload) => mutate({ variables: { id, input } }),
    loading,
  };
}

export function useDeleteHoliday() {
  const [mutate, { loading }] = useMutation<{ deleteHoliday: boolean }, { id: string }>(
    DELETE_HOLIDAY,
    { refetchQueries: ['Holidays'] },
  );
  return {
    mutate: (id: string) => mutate({ variables: { id } }),
    loading,
  };
}
