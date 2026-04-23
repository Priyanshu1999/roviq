import type {
  AbsenteeReportRow,
  AbsenteesReportQuery,
  AttendanceEntryRecord,
  AttendanceSessionRecord,
  CreateSessionData,
  SectionDailyBreakdownRow,
  SessionDateRangeQuery,
  SessionQuery,
  StudentHistoryQuery,
  StudentHistoryRow,
  UpsertEntryData,
} from './types';

export abstract class AttendanceRepository {
  abstract findSessionById(id: string): Promise<AttendanceSessionRecord | null>;
  abstract findSession(query: SessionQuery): Promise<AttendanceSessionRecord | null>;
  abstract findSessionsInRange(query: SessionDateRangeQuery): Promise<AttendanceSessionRecord[]>;
  abstract createSession(data: CreateSessionData): Promise<AttendanceSessionRecord>;
  abstract assignLecturer(sessionId: string, lecturerId: string): Promise<AttendanceSessionRecord>;
  abstract setSubject(
    sessionId: string,
    subjectId: string | null,
  ): Promise<AttendanceSessionRecord>;

  abstract findEntriesBySession(sessionId: string): Promise<AttendanceEntryRecord[]>;
  abstract findEntry(sessionId: string, studentId: string): Promise<AttendanceEntryRecord | null>;
  abstract bulkInsertEntries(
    entries: Array<Omit<UpsertEntryData, 'sessionId'> & { sessionId: string }>,
  ): Promise<AttendanceEntryRecord[]>;
  abstract upsertEntry(data: UpsertEntryData): Promise<AttendanceEntryRecord>;

  abstract countByStatus(sessionId: string): Promise<Record<string, number>>;
  abstract countForDate(date: string): Promise<Record<string, number>>;

  abstract absenteesReport(query: AbsenteesReportQuery): Promise<AbsenteeReportRow[]>;
  abstract sectionDailyBreakdown(date: string): Promise<SectionDailyBreakdownRow[]>;
  abstract studentHistory(query: StudentHistoryQuery): Promise<StudentHistoryRow[]>;

  abstract softDeleteSession(id: string): Promise<void>;
}
