'use client';

import { extractGraphQLError } from '@roviq/graphql';
import { useI18nField } from '@roviq/i18n';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  Can,
  Card,
  CardContent,
  DataTable,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@roviq/ui';
import { type ColumnDef, createColumnHelper } from '@tanstack/react-table';
import { BarChart3, CalendarDays, CheckCheck, ClipboardCheck, Users } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { parseAsInteger, parseAsString, useQueryState } from 'nuqs';
import * as React from 'react';
import { toast } from 'sonner';
import { useAcademicYears } from '../academic-years/use-academic-years';
import { useSections, useStandards } from '../academics/use-academics';
import {
  type AttendanceStatus,
  type SectionStudent,
  type StatusCount,
  useBulkMarkAttendance,
  useDateCounts,
  useMarkAttendance,
  useOpenSession,
  useOverrideSession,
  useSessionCounts,
  useSessionEntries,
  useSessionsForSection,
  useStudentsInSection,
} from './use-attendance';

const STATUS_COLORS: Record<AttendanceStatus, string> = {
  PRESENT: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  ABSENT: 'bg-rose-100 text-rose-700 border-rose-200',
  LEAVE: 'bg-amber-100 text-amber-700 border-amber-200',
  LATE: 'bg-sky-100 text-sky-700 border-sky-200',
};

const STATUS_CYCLE: AttendanceStatus[] = ['PRESENT', 'ABSENT', 'LEAVE', 'LATE'];

function todayIso(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export default function AttendancePage() {
  const t = useTranslations('attendance');
  const resolveI18n = useI18nField();
  const params = useParams();
  const locale = params.locale as string;

  const [date, setDate] = useQueryState('date', parseAsString.withDefault(todayIso()));
  const [yearId, setYearId] = useQueryState('year', parseAsString);
  const [standardId, setStandardId] = useQueryState('standard', parseAsString);
  const [sectionId, setSectionId] = useQueryState('section', parseAsString);
  const [period, setPeriod] = useQueryState('period', parseAsInteger);

  const { years } = useAcademicYears();
  const activeYearId = yearId ?? years.find((y) => y.status === 'ACTIVE')?.id ?? null;
  React.useEffect(() => {
    if (!yearId && activeYearId) void setYearId(activeYearId);
  }, [yearId, activeYearId, setYearId]);

  const { standards } = useStandards(activeYearId);
  const { sections } = useSections(standardId);
  const { students, loading: studentsLoading } = useStudentsInSection(sectionId);

  const { sessions, refetch: refetchSessions } = useSessionsForSection(sectionId, date, date);
  const currentSession = sessions.find((s) => (s.period ?? null) === (period ?? null)) ?? null;

  const { entries, refetch: refetchEntries } = useSessionEntries(currentSession?.id ?? null);
  const { counts: sessionCounts } = useSessionCounts(currentSession?.id ?? null);
  const { counts: dayCounts } = useDateCounts(date ?? todayIso());

  const { openSession, loading: opening } = useOpenSession();
  const { override, loading: overriding } = useOverrideSession();
  const { mark } = useMarkAttendance();
  const { bulkMark, loading: bulkSaving } = useBulkMarkAttendance();

  const entriesByStudent = React.useMemo(
    () => new Map(entries.map((e) => [e.studentId, e])),
    [entries],
  );

  async function handleOpenSession() {
    if (!sectionId || !activeYearId) return;
    // lecturerId: current teacher membership — temporarily pulled from the first
    // teacher membership if exposed via JWT. For now, expect the UI to pass a
    // default class-teacher membership. A future iteration will read this from
    // auth context.
    const section = sections.find((s) => s.id === sectionId);
    const lecturerId = section?.classTeacherId ?? null;
    if (!lecturerId) {
      toast.error(t('errors.LECTURER_REQUIRED'));
      return;
    }
    try {
      await openSession({
        sectionId,
        academicYearId: activeYearId,
        date: date ?? todayIso(),
        period,
        lecturerId,
      });
      toast.success(t('sessionOpened'));
      await refetchSessions();
    } catch (err) {
      const msg = extractGraphQLError(err, t('errors.SESSION_TAKEN'));
      toast.error(msg);
    }
  }

  async function setStatus(studentMembershipId: string, status: AttendanceStatus) {
    if (!currentSession) return;
    try {
      await mark({ sessionId: currentSession.id, studentId: studentMembershipId, status });
    } catch (err) {
      toast.error(extractGraphQLError(err, 'Failed'));
    }
  }

  async function markAllPresent() {
    if (!currentSession) return;
    const missing = students
      .filter((s) => !entriesByStudent.has(s.membershipId))
      .map((s) => ({ studentId: s.membershipId, status: 'PRESENT' as AttendanceStatus }));
    if (missing.length === 0) return;
    try {
      await bulkMark(currentSession.id, missing);
      toast.success(t('markAllDone'));
      await refetchEntries();
    } catch (err) {
      toast.error(extractGraphQLError(err, 'Failed'));
    }
  }

  return (
    <Can I="read" a="Attendance" passThrough>
      {(allowed: boolean) =>
        allowed ? (
          <div className="space-y-6">
            <header className="flex items-center justify-between gap-4">
              <div>
                <h1
                  className="text-2xl font-semibold tracking-tight flex items-center gap-2"
                  data-testid="attendance-title"
                >
                  <ClipboardCheck className="size-6 text-primary" />
                  {t('title')}
                </h1>
              </div>
              <div className="flex items-center gap-3">
                <DaySummary counts={dayCounts} />
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  data-testid="attendance-reports-link"
                >
                  <Link href={`/${locale}/institute/attendance/reports`}>
                    <BarChart3 className="size-4" />
                    {t('reports.openLink')}
                  </Link>
                </Button>
              </div>
            </header>

            <Card>
              <CardContent className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <span className="text-xs font-medium text-muted-foreground mb-1 block">
                      {t('pickDate')}
                    </span>
                    <Input
                      type="date"
                      value={date ?? ''}
                      onChange={(e) => setDate(e.target.value || null)}
                      data-testid="attendance-date-input"
                    />
                  </div>
                  <div>
                    <span className="text-xs font-medium text-muted-foreground mb-1 block">
                      {t('period')}
                    </span>
                    <Select
                      value={period === null || period === undefined ? '__daily__' : String(period)}
                      onValueChange={(v) =>
                        setPeriod(v === '__daily__' ? null : Number.parseInt(v, 10))
                      }
                    >
                      <SelectTrigger data-testid="attendance-period-select">
                        <SelectValue placeholder={t('dailyMode')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__daily__">{t('dailyMode')}</SelectItem>
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((p) => (
                          <SelectItem key={p} value={String(p)}>
                            {`${t('period')} ${p}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-muted-foreground mb-1 block">
                      {t('pickSection')}
                    </span>
                    <Select
                      value={standardId ?? '__none__'}
                      onValueChange={(v) => {
                        void setStandardId(v === '__none__' ? null : v);
                        void setSectionId(null);
                      }}
                    >
                      <SelectTrigger data-testid="attendance-standard-select">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">—</SelectItem>
                        {standards.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {resolveI18n(s.name)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-muted-foreground mb-1 block">
                      {t('pickSection')}
                    </span>
                    <Select
                      value={sectionId ?? '__none__'}
                      onValueChange={(v) => setSectionId(v === '__none__' ? null : v)}
                    >
                      <SelectTrigger data-testid="attendance-section-select">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">—</SelectItem>
                        {sections.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {resolveI18n(s.name)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {!sectionId ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Users />
                  </EmptyMedia>
                  <EmptyTitle>{t('selectSectionFirst')}</EmptyTitle>
                </EmptyHeader>
              </Empty>
            ) : !currentSession ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <CalendarDays />
                  </EmptyMedia>
                  <EmptyTitle>{t('noSession')}</EmptyTitle>
                  <EmptyDescription>{date}</EmptyDescription>
                </EmptyHeader>
                <Can I="create" a="Attendance">
                  <Button
                    onClick={handleOpenSession}
                    disabled={opening}
                    data-testid="attendance-open-session-btn"
                  >
                    {opening ? t('opening') : t('openSession')}
                  </Button>
                </Can>
              </Empty>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <SessionSummary counts={sessionCounts} />
                  <div className="flex items-center gap-2">
                    {sectionId &&
                      (() => {
                        const section = sections.find((s) => s.id === sectionId);
                        const myLecturerId = section?.classTeacherId;
                        const isOtherLecturer = Boolean(
                          myLecturerId && currentSession.lecturerId !== myLecturerId,
                        );
                        if (!isOtherLecturer) return null;
                        return (
                          <Can I="update" a="Attendance">
                            <Button
                              variant="outline"
                              className="gap-2"
                              disabled={overriding}
                              data-testid="attendance-override-btn"
                              onClick={async () => {
                                if (!myLecturerId) return;
                                try {
                                  await override({
                                    sessionId: currentSession.id,
                                    lecturerId: myLecturerId,
                                    subjectId: currentSession.subjectId,
                                  });
                                  await refetchSessions();
                                  toast.success(t('overrideDone'));
                                } catch (err) {
                                  toast.error(extractGraphQLError(err, 'Failed'));
                                }
                              }}
                            >
                              {overriding ? t('overriding') : t('override')}
                            </Button>
                          </Can>
                        );
                      })()}
                    <Can I="update" a="Attendance">
                      <Button
                        variant="secondary"
                        onClick={markAllPresent}
                        disabled={bulkSaving || studentsLoading}
                        className="gap-2"
                        data-testid="attendance-mark-all-present-btn"
                      >
                        <CheckCheck className="size-4" />
                        {t('markAll')}
                      </Button>
                    </Can>
                  </div>
                </div>

                <div className="hidden md:block">
                  <DataTable
                    columns={buildStudentColumns({
                      t,
                      resolveI18n,
                      entriesByStudent,
                      onStatusChange: setStatus,
                    })}
                    data={students}
                    data-testid="attendance-roster-table"
                  />
                </div>

                {/* Mobile variant — desktop uses DataTable above */}
                <ul className="md:hidden flex flex-col gap-2" data-testid="attendance-roster-list">
                  {students.map((stu) => {
                    const initial = (resolveI18n(stu.firstName) ?? '?')[0];
                    const current = entriesByStudent.get(stu.membershipId)?.status ?? null;
                    const fullName = `${resolveI18n(stu.firstName) ?? ''}${
                      stu.lastName ? ` ${resolveI18n(stu.lastName) ?? ''}` : ''
                    }`.trim();
                    return (
                      <li key={stu.membershipId}>
                        <Card>
                          <CardContent
                            className="p-3 space-y-3"
                            data-testid={`attendance-row-${stu.membershipId}`}
                          >
                            <div className="flex items-center gap-3">
                              <Avatar className="size-10 shrink-0">
                                {stu.profileImageUrl ? (
                                  <AvatarImage src={stu.profileImageUrl} alt={fullName} />
                                ) : null}
                                <AvatarFallback>{initial}</AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex-1">
                                <p className="font-medium leading-tight truncate">{fullName}</p>
                                <p className="text-xs text-muted-foreground tabular-nums truncate">
                                  {stu.admissionNumber}
                                </p>
                              </div>
                            </div>
                            <div className="grid grid-cols-4 gap-1.5">
                              {STATUS_CYCLE.map((s) => {
                                const isActive = current === s;
                                const label = t(
                                  s.toLowerCase() as 'present' | 'absent' | 'leave' | 'late',
                                );
                                return (
                                  <Button
                                    key={s}
                                    type="button"
                                    variant={isActive ? 'default' : 'outline'}
                                    className={`h-11 min-w-11 text-sm font-medium ${
                                      isActive ? STATUS_COLORS[s] : ''
                                    }`}
                                    onClick={() => setStatus(stu.membershipId, s)}
                                    data-testid={`attendance-${stu.membershipId}-${s}-btn`}
                                    title={label}
                                  >
                                    {label}
                                  </Button>
                                );
                              })}
                            </div>
                          </CardContent>
                        </Card>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center min-h-[400px]">
            <p className="text-muted-foreground">{t('accessDenied')}</p>
          </div>
        )
      }
    </Can>
  );
}

type StudentColumnArgs = {
  t: ReturnType<typeof useTranslations<'attendance'>>;
  resolveI18n: ReturnType<typeof useI18nField>;
  entriesByStudent: Map<string, { status: AttendanceStatus }>;
  onStatusChange: (membershipId: string, status: AttendanceStatus) => void;
};

function buildStudentColumns({
  t,
  resolveI18n,
  entriesByStudent,
  onStatusChange,
}: StudentColumnArgs): ColumnDef<SectionStudent, unknown>[] {
  const helper = createColumnHelper<SectionStudent>();
  return [
    helper.accessor('firstName', {
      header: t('student'),
      cell: ({ row }) => {
        const stu = row.original;
        const initial = (resolveI18n(stu.firstName) ?? '?')[0];
        return (
          <div
            className="flex items-center gap-2"
            data-testid={`attendance-row-${stu.membershipId}`}
          >
            <Avatar className="size-7">
              {stu.profileImageUrl ? (
                <AvatarImage src={stu.profileImageUrl} alt={resolveI18n(stu.firstName) ?? ''} />
              ) : null}
              <AvatarFallback className="text-xs">{initial}</AvatarFallback>
            </Avatar>
            <span className="font-medium">
              {resolveI18n(stu.firstName)} {stu.lastName ? resolveI18n(stu.lastName) : ''}
            </span>
          </div>
        );
      },
    }) as ColumnDef<SectionStudent, unknown>,
    helper.accessor('admissionNumber', {
      header: t('admissionNumber'),
      cell: ({ getValue }) => (
        <span className="text-muted-foreground tabular-nums">{String(getValue())}</span>
      ),
    }) as ColumnDef<SectionStudent, unknown>,
    helper.display({
      id: 'status',
      header: t('status'),
      cell: ({ row }) => {
        const stu = row.original;
        const current = entriesByStudent.get(stu.membershipId)?.status ?? null;
        return (
          <div className="flex gap-1.5">
            {STATUS_CYCLE.map((s) => {
              const isActive = current === s;
              return (
                <Button
                  key={s}
                  type="button"
                  size="sm"
                  variant={isActive ? 'default' : 'outline'}
                  className={`h-8 px-2 text-xs font-medium ${isActive ? STATUS_COLORS[s] : ''}`}
                  onClick={() => onStatusChange(stu.membershipId, s)}
                  data-testid={`attendance-${stu.membershipId}-${s}-btn`}
                  title={t(s.toLowerCase() as 'present' | 'absent' | 'leave' | 'late')}
                >
                  {t(s.toLowerCase() as 'present' | 'absent' | 'leave' | 'late')}
                </Button>
              );
            })}
          </div>
        );
      },
    }) as ColumnDef<SectionStudent, unknown>,
  ];
}

function DaySummary({ counts }: { counts: StatusCount[] }) {
  const t = useTranslations('attendance');
  if (counts.length === 0) return null;
  return (
    <div className="flex items-center gap-2">
      {counts.map((c) => (
        <Badge
          key={c.status}
          variant="outline"
          className={`${STATUS_COLORS[c.status as AttendanceStatus] ?? ''} border-0`}
          data-testid={`attendance-day-count-${c.status}`}
        >
          {t(`counts.${c.status}` as Parameters<typeof t>[0])}: {c.count}
        </Badge>
      ))}
    </div>
  );
}

function SessionSummary({ counts }: { counts: StatusCount[] }) {
  const t = useTranslations('attendance');
  return (
    <div className="flex items-center gap-2" data-testid="attendance-session-summary">
      {counts.length === 0 ? (
        <span className="text-xs text-muted-foreground">{t('summary')}</span>
      ) : (
        counts.map((c) => (
          <Badge
            key={c.status}
            className={`${STATUS_COLORS[c.status as AttendanceStatus] ?? ''} border-0`}
          >
            {t(`counts.${c.status}` as Parameters<typeof t>[0])}: {c.count}
          </Badge>
        ))
      )}
    </div>
  );
}
