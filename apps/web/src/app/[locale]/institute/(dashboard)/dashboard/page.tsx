'use client';

import { Link } from '@roviq/i18n';
import { Button, Can, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@roviq/ui';
import {
  Award,
  BookOpen,
  CalendarCheck,
  FileText,
  GraduationCap,
  Settings,
  ShieldCheck,
  UserCheck,
  UserCog,
  UserRound,
  Users,
  Users2,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type AttendanceStatus, useDateCounts } from '../attendance/use-attendance';

// Same palette as the attendance page's STATUS_COLORS — kept intentionally
// consistent so the dashboard KPI reads as a preview of that screen.
const ATTENDANCE_KPI_COLORS: Record<AttendanceStatus, string> = {
  PRESENT: 'bg-emerald-100 text-emerald-700',
  ABSENT: 'bg-rose-100 text-rose-700',
  LEAVE: 'bg-amber-100 text-amber-700',
  LATE: 'bg-sky-100 text-sky-700',
};

function todayIso(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function AttendanceKpiCard() {
  const t = useTranslations('dashboard.attendanceKpi');
  const { counts, loading } = useDateCounts(todayIso());

  const byStatus = new Map<AttendanceStatus, number>(counts.map((c) => [c.status, c.count]));
  const present = byStatus.get('PRESENT') ?? 0;
  const absent = byStatus.get('ABSENT') ?? 0;
  const leave = byStatus.get('LEAVE') ?? 0;
  const late = byStatus.get('LATE') ?? 0;
  const total = present + absent + leave + late;

  const badgeItems: Array<{ status: AttendanceStatus; label: string; value: number }> = [
    { status: 'PRESENT', label: t('present'), value: present },
    { status: 'ABSENT', label: t('absent'), value: absent },
    { status: 'LEAVE', label: t('leave'), value: leave },
    { status: 'LATE', label: t('late'), value: late },
  ];

  return (
    <Card className="transition-shadow hover:shadow-md" data-testid="dashboard-attendance-kpi-card">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <CalendarCheck className="size-5 text-muted-foreground" aria-hidden="true" />
          <CardTitle className="text-base">{t('title')}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {total === 0 && !loading ? (
          <CardDescription>{t('noData')}</CardDescription>
        ) : (
          <>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold tabular-nums">{present}</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                / {total} {t('total')}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {badgeItems.map((item) => (
                <span
                  key={item.status}
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                    ATTENDANCE_KPI_COLORS[item.status]
                  }`}
                  data-testid={`dashboard-attendance-kpi-${item.status}`}
                >
                  {item.label}: <span className="tabular-nums">{item.value}</span>
                </span>
              ))}
            </div>
          </>
        )}
        <Button variant="link" className="h-auto p-0" asChild>
          <Link href="/institute/attendance" data-testid="dashboard-attendance-kpi-link">
            {t('viewDetails')}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const t = useTranslations('dashboard');

  // Quick links — every entry must point to a route that exists in
  // app/[locale]/institute/(dashboard)/. Stale URLs (/standards, /subjects,
  // /users, /students, /teachers) are removed in favour of the live routes
  // shipped this session.
  const quickLinks = [
    {
      id: 'standards',
      title: t('manageStandards'),
      description: t('manageStandardsDescription'),
      href: '/academics',
      icon: GraduationCap,
    },
    {
      id: 'subjects',
      title: t('manageSubjects'),
      description: t('manageSubjectsDescription'),
      href: '/academics?tab=subjects',
      icon: BookOpen,
    },
    {
      id: 'users',
      title: t('manageUsers'),
      description: t('instituteManageUsersDescription'),
      href: '/people/staff',
      icon: UserCog,
    },
    {
      id: 'settings',
      title: t('viewSettings'),
      description: t('instituteViewSettingsDescription'),
      href: '/settings',
      icon: Settings,
    },
  ];

  const emptyStates = [
    {
      title: t('emptyStudentsTitle'),
      description: t('emptyStudentsDescription'),
      cta: t('emptyStudentsCta'),
      href: '/people/students',
      icon: Users,
    },
    {
      title: t('emptyTeachersTitle'),
      description: t('emptyTeachersDescription'),
      cta: t('emptyTeachersCta'),
      href: '/people/staff',
      icon: UserCheck,
    },
    {
      title: t('emptyStandardsTitle'),
      description: t('emptyStandardsDescription'),
      cta: t('emptyStandardsCta'),
      href: '/academics',
      icon: GraduationCap,
    },
  ];

  // Newly-shipped feature shortcuts — Students, Guardians, Groups, TC,
  // Certificates, Data Consent, My Profile. These are the pages built in
  // ROV-167/169/170 and surfaced on the dashboard for discoverability.
  const featureLinks = [
    {
      title: t('studentsTitle'),
      description: t('studentsDescription'),
      href: '/people/students',
      icon: Users,
    },
    {
      title: t('guardiansTitle'),
      description: t('guardiansDescription'),
      href: '/people/guardians',
      icon: UserCheck,
    },
    {
      title: t('groupsTitle'),
      description: t('groupsDescription'),
      href: '/groups',
      icon: Users2,
    },
    {
      title: t('tcTitle'),
      description: t('tcDescription'),
      href: '/certificates/tc',
      icon: FileText,
    },
    {
      title: t('certificatesTitle'),
      description: t('certificatesDescription'),
      href: '/certificates/other',
      icon: Award,
    },
    {
      title: t('consentTitle'),
      description: t('consentDescription'),
      href: '/settings/consent',
      icon: ShieldCheck,
    },
    {
      title: t('profileTitle'),
      description: t('profileDescription'),
      href: '/profile',
      icon: UserRound,
    },
  ];

  return (
    <div className="space-y-6">
      <Card data-testid="dashboard-welcome-card">
        <CardHeader>
          <CardTitle className="text-2xl">{t('instituteWelcome')}</CardTitle>
          <CardDescription>{t('instituteWelcomeDescription')}</CardDescription>
        </CardHeader>
      </Card>
      <Can I="read" a="Attendance">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <AttendanceKpiCard />
        </div>
      </Can>
      <div data-testid="dashboard-get-started">
        <CardTitle className="mb-4 text-lg">{t('getStarted')}</CardTitle>
        <div className="grid gap-4 md:grid-cols-3">
          {emptyStates.map((state) => (
            <Card key={state.href}>
              <CardContent className="flex flex-col items-center gap-3 pt-6 text-center">
                <state.icon className="size-8 text-muted-foreground" />
                <CardTitle className="text-base">{state.title}</CardTitle>
                <CardDescription>{state.description}</CardDescription>
                <Button variant="outline" size="sm" asChild>
                  <Link href={state.href}>{state.cta}</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      <div>
        <CardTitle className="mb-4 text-lg">{t('features')}</CardTitle>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {featureLinks.map((link) => (
            <Card key={link.href} className="transition-shadow hover:shadow-md">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <link.icon className="size-5 text-muted-foreground" aria-hidden="true" />
                  <CardTitle className="text-base">
                    <Button variant="link" className="h-auto p-0" asChild>
                      <Link href={link.href}>{link.title}</Link>
                    </Button>
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription>{link.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      <div data-testid="dashboard-quick-links">
        <CardTitle className="mb-4 text-lg">{t('quickLinks')}</CardTitle>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {quickLinks.map((link) => (
            <Card key={link.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <link.icon className="size-5 text-muted-foreground" aria-hidden="true" />
                  <CardTitle className="text-base">
                    <Button variant="link" className="h-auto p-0" asChild>
                      <Link href={link.href} data-testid={`dashboard-quick-link-${link.id}`}>
                        {link.title}
                      </Link>
                    </Button>
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription>{link.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
