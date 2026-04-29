'use client';

import { gql, useMutation, useQuery } from '@roviq/graphql';

// ── Fragments / queries ────────────────────────────────────────────────

const SESSIONS_FOR_SECTION = gql`
  query AttendanceSessionsForSection($sectionId: ID!, $startDate: String!, $endDate: String!) {
    attendanceSessionsForSection(sectionId: $sectionId, startDate: $startDate, endDate: $endDate) {
      id
      sectionId
      academicYearId
      date
      period
      subjectId
      lecturerId
      overrideCheck
      createdAt
      updatedAt
    }
  }
`;

const SESSION_ENTRIES = gql`
  query AttendanceEntries($sessionId: ID!) {
    attendanceEntries(sessionId: $sessionId) {
      id
      sessionId
      studentId
      status
      mode
      remarks
      markedAt
    }
  }
`;

const SESSION_COUNTS = gql`
  query AttendanceCounts($sessionId: ID!) {
    attendanceCounts(sessionId: $sessionId) {
      status
      count
    }
  }
`;

const DATE_COUNTS = gql`
  query AttendanceCountsForDate($date: String!) {
    attendanceCountsForDate(date: $date) {
      status
      count
    }
  }
`;

const OPEN_SESSION = gql`
  mutation OpenAttendanceSession($input: CreateAttendanceSessionInput!) {
    openAttendanceSession(input: $input) {
      id
      sectionId
      academicYearId
      date
      period
      subjectId
      lecturerId
    }
  }
`;

const MARK_ATTENDANCE = gql`
  mutation MarkAttendance($input: MarkAttendanceInput!) {
    markAttendance(input: $input) {
      id
      sessionId
      studentId
      status
      mode
      remarks
      markedAt
    }
  }
`;

const BULK_MARK = gql`
  mutation BulkMarkAttendance($input: BulkMarkAttendanceInput!) {
    bulkMarkAttendance(input: $input) {
      id
      studentId
      status
    }
  }
`;

const LIST_STUDENTS_IN_SECTION = gql`
  query StudentsInSection($sectionId: ID!) {
    listStudents(filter: { sectionId: $sectionId, first: 1000 }) {
      edges {
        node {
          id
          membershipId
          firstName
          lastName
          admissionNumber
          profileImageUrl
        }
      }
    }
  }
`;

// ── Types ────────────────────────────────────────────────────────────

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LEAVE' | 'LATE';

export interface AttendanceSession {
  id: string;
  sectionId: string;
  academicYearId: string;
  date: string;
  period: number | null;
  subjectId: string | null;
  lecturerId: string;
  overrideCheck: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceEntry {
  id: string;
  sessionId: string;
  studentId: string;
  status: AttendanceStatus;
  mode: string;
  remarks: string | null;
  markedAt: string;
}

export interface StatusCount {
  status: AttendanceStatus;
  count: number;
}

export interface SectionStudent {
  id: string;
  membershipId: string;
  firstName: Record<string, string>;
  lastName: Record<string, string> | null;
  admissionNumber: string;
  profileImageUrl: string | null;
}

// ── Hooks ────────────────────────────────────────────────────────────

export function useSessionsForSection(
  sectionId: string | null,
  startDate: string,
  endDate: string,
) {
  const { data, loading, refetch } = useQuery<{
    attendanceSessionsForSection: AttendanceSession[];
  }>(SESSIONS_FOR_SECTION, {
    variables: { sectionId, startDate, endDate },
    skip: !sectionId,
  });
  return { sessions: data?.attendanceSessionsForSection ?? [], loading, refetch };
}

export function useSessionEntries(sessionId: string | null) {
  const { data, loading, refetch } = useQuery<{ attendanceEntries: AttendanceEntry[] }>(
    SESSION_ENTRIES,
    { variables: { sessionId }, skip: !sessionId },
  );
  return { entries: data?.attendanceEntries ?? [], loading, refetch };
}

export function useSessionCounts(sessionId: string | null) {
  const { data } = useQuery<{ attendanceCounts: StatusCount[] }>(SESSION_COUNTS, {
    variables: { sessionId },
    skip: !sessionId,
    pollInterval: 15000,
  });
  return { counts: data?.attendanceCounts ?? [] };
}

export function useDateCounts(date: string) {
  const { data, loading } = useQuery<{ attendanceCountsForDate: StatusCount[] }>(DATE_COUNTS, {
    variables: { date },
  });
  return { counts: data?.attendanceCountsForDate ?? [], loading };
}

export function useOpenSession() {
  const [mutate, { loading }] = useMutation(OPEN_SESSION, {
    refetchQueries: ['AttendanceSessionsForSection', 'AttendanceCountsForDate'],
  });
  return {
    openSession: (input: {
      sectionId: string;
      academicYearId: string;
      date: string;
      period?: number | null;
      subjectId?: string | null;
      lecturerId: string;
    }) => mutate({ variables: { input } }),
    loading,
  };
}

export function useMarkAttendance() {
  const [mutate, { loading }] = useMutation(MARK_ATTENDANCE, {
    refetchQueries: ['AttendanceEntries', 'AttendanceCounts', 'AttendanceCountsForDate'],
  });
  return {
    mark: (input: {
      sessionId: string;
      studentId: string;
      status: AttendanceStatus;
      remarks?: string | null;
    }) => mutate({ variables: { input } }),
    loading,
  };
}

export function useBulkMarkAttendance() {
  const [mutate, { loading }] = useMutation(BULK_MARK, {
    refetchQueries: ['AttendanceEntries', 'AttendanceCounts', 'AttendanceCountsForDate'],
  });
  return {
    bulkMark: (
      sessionId: string,
      entries: Array<{ studentId: string; status: AttendanceStatus }>,
    ) => mutate({ variables: { input: { sessionId, entries } } }),
    loading,
  };
}

export function useStudentsInSection(sectionId: string | null) {
  const { data, loading } = useQuery<{
    listStudents: { edges: Array<{ node: SectionStudent }> };
  }>(LIST_STUDENTS_IN_SECTION, {
    variables: { sectionId },
    skip: !sectionId,
  });
  return {
    students: data?.listStudents.edges.map((e) => e.node) ?? [],
    loading,
  };
}

// ── Reports ──────────────────────────────────────────────────────────

const ABSENTEES_REPORT = gql`
  query AttendanceAbsenteesReport($sectionId: ID, $startDate: String!, $endDate: String!) {
    attendanceAbsenteesReport(sectionId: $sectionId, startDate: $startDate, endDate: $endDate) {
      studentId
      totalSessions
      presentCount
      absentCount
      leaveCount
      lateCount
      absentDates
    }
  }
`;

const SECTION_DAILY_BREAKDOWN = gql`
  query AttendanceSectionDailyBreakdown($date: String!) {
    attendanceSectionDailyBreakdown(date: $date) {
      sectionId
      sectionName
      period
      subjectId
      lecturerId
      presentCount
      absentCount
      leaveCount
      lateCount
      absenteeIds
    }
  }
`;

export interface AbsenteeReportItem {
  studentId: string;
  totalSessions: number;
  presentCount: number;
  absentCount: number;
  leaveCount: number;
  lateCount: number;
  absentDates: string[];
}

export interface SectionDailyBreakdown {
  sectionId: string;
  sectionName: Record<string, string>;
  period: number | null;
  subjectId: string | null;
  lecturerId: string;
  presentCount: number;
  absentCount: number;
  leaveCount: number;
  lateCount: number;
  absenteeIds: string[];
}

/**
 * Absentee report aggregated per-student for the given date range. When
 * `sectionId` is null the backend aggregates across the entire tenant
 * (still bounded by the caller's CASL subject scope). The hook skips the
 * query until both dates are provided — otherwise Apollo would fire with
 * empty strings and the resolver would reject the input.
 */
export function useAbsenteesReport(sectionId: string | null, startDate: string, endDate: string) {
  const { data, loading, error, refetch } = useQuery<{
    attendanceAbsenteesReport: AbsenteeReportItem[];
  }>(ABSENTEES_REPORT, {
    variables: { sectionId, startDate, endDate },
    skip: !startDate || !endDate,
  });
  return {
    rows: data?.attendanceAbsenteesReport ?? [],
    loading,
    error,
    refetch,
  };
}

/**
 * Section-level counts for every attendance session on a single date.
 * Used by the "Daily breakdown" reports tab — the backend returns one
 * row per (section, period) pair so a class taking multiple periods on
 * the same day renders as several rows.
 */
export function useSectionDailyBreakdown(date: string) {
  const { data, loading, error, refetch } = useQuery<{
    attendanceSectionDailyBreakdown: SectionDailyBreakdown[];
  }>(SECTION_DAILY_BREAKDOWN, {
    variables: { date },
    skip: !date,
  });
  return {
    rows: data?.attendanceSectionDailyBreakdown ?? [],
    loading,
    error,
    refetch,
  };
}

// ── Override + student history ────────────────────────────────────────

const OVERRIDE_SESSION = gql`
  mutation OverrideAttendanceSession($sessionId: ID!, $lecturerId: ID!, $subjectId: ID) {
    overrideAttendanceSession(
      sessionId: $sessionId
      lecturerId: $lecturerId
      subjectId: $subjectId
    ) {
      id
      lecturerId
      subjectId
    }
  }
`;

const STUDENT_HISTORY = gql`
  query AttendanceStudentHistory($studentId: ID!, $startDate: String!, $endDate: String!) {
    attendanceStudentHistory(studentId: $studentId, startDate: $startDate, endDate: $endDate) {
      sessionId
      sectionId
      date
      period
      subjectId
      status
      remarks
      markedAt
    }
  }
`;

export interface StudentHistoryItem {
  sessionId: string;
  sectionId: string;
  date: string;
  period: number | null;
  subjectId: string | null;
  status: AttendanceStatus;
  remarks: string | null;
  markedAt: string;
}

export function useOverrideSession() {
  const [mutate, { loading }] = useMutation(OVERRIDE_SESSION, {
    refetchQueries: ['AttendanceSessionsForSection'],
  });
  return {
    override: (input: { sessionId: string; lecturerId: string; subjectId?: string | null }) =>
      mutate({ variables: input }),
    loading,
  };
}

export function useStudentHistory(studentId: string | null, startDate: string, endDate: string) {
  const { data, loading, error, refetch } = useQuery<{
    attendanceStudentHistory: StudentHistoryItem[];
  }>(STUDENT_HISTORY, {
    variables: { studentId, startDate, endDate },
    skip: !studentId || !startDate || !endDate,
  });
  return {
    rows: data?.attendanceStudentHistory ?? [],
    loading,
    error,
    refetch,
  };
}
