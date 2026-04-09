'use client';

import { Link } from '@roviq/i18n';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@roviq/ui';
import {
  Award,
  BookOpen,
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

export default function DashboardPage() {
  const t = useTranslations('dashboard');

  // Quick links — every entry must point to a route that exists in
  // app/[locale]/institute/(dashboard)/. Stale URLs (/standards, /subjects,
  // /users, /students, /teachers) are removed in favour of the live routes
  // shipped this session.
  const quickLinks = [
    {
      title: t('manageStandards'),
      description: t('manageStandardsDescription'),
      href: '/academics',
      icon: GraduationCap,
    },
    {
      title: t('manageSubjects'),
      description: t('manageSubjectsDescription'),
      href: '/academics',
      icon: BookOpen,
    },
    {
      title: t('manageUsers'),
      description: t('instituteManageUsersDescription'),
      href: '/people/staff',
      icon: UserCog,
    },
    {
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
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{t('instituteWelcome')}</CardTitle>
          <CardDescription>{t('instituteWelcomeDescription')}</CardDescription>
        </CardHeader>
      </Card>
      <div>
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
      <div>
        <CardTitle className="mb-4 text-lg">{t('quickLinks')}</CardTitle>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {quickLinks.map((link) => (
            <Card key={link.href}>
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
    </div>
  );
}
