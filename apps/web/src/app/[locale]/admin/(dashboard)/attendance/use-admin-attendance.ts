'use client';

/**
 * Cross-tenant attendance roll-up hook.
 *
 * The GraphQL document stays untyped (`gql` not `TypedDocumentNode`) and we
 * annotate the explicit shape on `useQuery`. Codegen is not wired here
 * because the surface is a single read query — adding a generated file for
 * one field saves nothing.
 */
import { gql, useQuery } from '@roviq/graphql';

export interface AdminAttendanceSummaryNode {
  instituteId: string;
  instituteName: Record<string, string>;
  presentCount: number;
  absentCount: number;
  leaveCount: number;
  lateCount: number;
  sessionCount: number;
}

interface AdminAttendanceSummaryData {
  adminAttendanceSummary: AdminAttendanceSummaryNode[];
}

interface AdminAttendanceSummaryVariables {
  date: string;
}

const ADMIN_ATTENDANCE_SUMMARY_QUERY = gql`
  query AdminAttendanceSummary($date: String!) {
    adminAttendanceSummary(date: $date) {
      instituteId
      instituteName
      presentCount
      absentCount
      leaveCount
      lateCount
      sessionCount
    }
  }
`;

export function useAdminAttendanceSummary(date: string) {
  const { data, loading, error, refetch } = useQuery<
    AdminAttendanceSummaryData,
    AdminAttendanceSummaryVariables
  >(ADMIN_ATTENDANCE_SUMMARY_QUERY, {
    variables: { date },
    skip: !date,
    notifyOnNetworkStatusChange: true,
  });

  return {
    summaries: data?.adminAttendanceSummary ?? [],
    loading,
    error,
    refetch,
  };
}
