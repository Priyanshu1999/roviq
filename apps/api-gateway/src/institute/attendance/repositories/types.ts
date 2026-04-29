import type { AttendanceMode, AttendanceStatus } from '@roviq/database';

export interface AttendanceSessionRecord {
  id: string;
  tenantId: string;
  sectionId: string;
  academicYearId: string;
  date: string;
  period: number | null;
  subjectId: string | null;
  lecturerId: string;
  overrideCheck: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AttendanceEntryRecord {
  id: string;
  tenantId: string;
  sessionId: string;
  studentId: string;
  status: AttendanceStatus;
  mode: AttendanceMode;
  remarks: string | null;
  markedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSessionData {
  sectionId: string;
  academicYearId: string;
  date: string;
  period?: number | null;
  subjectId?: string | null;
  lecturerId: string;
}

export interface UpsertEntryData {
  sessionId: string;
  studentId: string;
  status: AttendanceStatus;
  mode?: AttendanceMode;
  remarks?: string | null;
}

export interface SessionQuery {
  sectionId: string;
  date: string;
  period?: number | null;
}

export interface SessionDateRangeQuery {
  sectionId?: string;
  startDate: string;
  endDate: string;
}

export interface AbsenteesReportQuery {
  sectionId?: string | null;
  startDate: string;
  endDate: string;
}

export interface AbsenteeReportRow {
  studentId: string;
  totalSessions: number;
  presentCount: number;
  absentCount: number;
  leaveCount: number;
  lateCount: number;
  absentDates: string[];
}

export interface SectionDailyBreakdownRow {
  sessionId: string;
  sectionId: string;
  /** Multi-language section name resolved from a JOIN — empty object when missing. */
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

export interface StudentHistoryQuery {
  studentId: string;
  startDate: string;
  endDate: string;
}

export interface StudentHistoryRow {
  sessionId: string;
  sectionId: string;
  date: string;
  period: number | null;
  subjectId: string | null;
  status: string;
  remarks: string | null;
  markedAt: Date;
}
