'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@roviq/ui';
import { useTranslations } from 'next-intl';

interface Shift {
  name: string;
  start: string;
  end: string;
}
interface Term {
  label: string;
  startDate: string;
  endDate: string;
}
interface SectionStrength {
  optimal?: number | null;
  hardMax?: number | null;
  exemptionAllowed?: boolean | null;
}
interface AdmissionNumberConfig {
  format?: string | null;
  yearFormat?: string | null;
  prefixes?: Record<string, string> | null;
  noPrefixFromClass?: number | null;
}

export interface InstituteConfig {
  attendanceType?: string | null;
  openingTime?: string | null;
  closingTime?: string | null;
  shifts?: Shift[] | null;
  gradingSystem?: Record<string, unknown> | null;
  termStructure?: Term[] | null;
  sectionStrengthNorms?: SectionStrength | null;
  admissionNumberConfig?: AdmissionNumberConfig | null;
  notificationPreferences?: Record<string, unknown> | null;
  payrollConfig?: Record<string, unknown> | null;
}

export function ConfigDisplay({ config }: { config: InstituteConfig | null | undefined }) {
  const t = useTranslations('adminInstitutes.config');

  if (!config) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
          <CardDescription>{t('description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4" data-testid={testIds.adminInstituteDetail.configDisplay}>
      <Card>
        <CardHeader>
          <CardTitle>{t('operationsTitle')}</CardTitle>
          <CardDescription>{t('operationsDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-muted-foreground">{t('attendanceType')}</dt>
              <dd className="font-medium">{config.attendanceType ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('openingTime')}</dt>
              <dd>{config.openingTime ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('closingTime')}</dt>
              <dd>{config.closingTime ?? '—'}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {config.shifts && config.shifts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('shiftsTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('shiftName')}</TableHead>
                  <TableHead>{t('shiftStart')}</TableHead>
                  <TableHead>{t('shiftEnd')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {config.shifts.map((s) => (
                  <TableRow key={s.name}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{s.start}</TableCell>
                    <TableCell>{s.end}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {config.termStructure && config.termStructure.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('termsTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('termLabel')}</TableHead>
                  <TableHead>{t('termStart')}</TableHead>
                  <TableHead>{t('termEnd')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {config.termStructure.map((term) => (
                  <TableRow key={term.label}>
                    <TableCell className="font-medium">{term.label}</TableCell>
                    <TableCell>{term.startDate}</TableCell>
                    <TableCell>{term.endDate}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {config.sectionStrengthNorms && (
        <Card>
          <CardHeader>
            <CardTitle>{t('strengthTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <dt className="text-muted-foreground">{t('strengthOptimal')}</dt>
                <dd className="font-medium">{config.sectionStrengthNorms.optimal ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('strengthHardMax')}</dt>
                <dd className="font-medium">{config.sectionStrengthNorms.hardMax ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('strengthExemptionAllowed')}</dt>
                <dd className="font-medium">
                  {config.sectionStrengthNorms.exemptionAllowed ? t('yes') : t('no')}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      )}

      {config.admissionNumberConfig && (
        <Card>
          <CardHeader>
            <CardTitle>{t('admissionTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-muted-foreground">{t('admissionFormat')}</dt>
                <dd className="font-mono text-xs">{config.admissionNumberConfig.format ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('admissionYearFormat')}</dt>
                <dd className="font-mono text-xs">
                  {config.admissionNumberConfig.yearFormat ?? '—'}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

import { testIds } from '@roviq/ui/testing/testid-registry';
