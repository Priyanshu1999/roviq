'use client';

import { ATTENDANCE_TYPE_VALUES, AttendanceType } from '@roviq/common-types';
import { extractGraphQLError } from '@roviq/graphql';
import {
  Badge,
  Can,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FieldDescription,
  FieldGroup,
  FieldSeparator,
  Skeleton,
  useAppForm,
} from '@roviq/ui';
import { useStore } from '@tanstack/react-form';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { toast } from 'sonner';
import { ShiftsBuilder } from './components/shifts-builder';
import { TermStructureBuilder } from './components/term-structure-builder';
import { type InstituteConfigFormValues, instituteConfigSchema } from './schemas';
import type { MyInstituteData } from './types';
import { useUpdateInstituteConfig } from './use-institute-settings';

interface InstituteConfigTabProps {
  institute: MyInstituteData['myInstitute'] | undefined;
  loading: boolean;
}

const DEFAULT_VALUES: InstituteConfigFormValues = {
  attendanceType: AttendanceType.DAILY,
  openingTime: '08:00',
  closingTime: '14:00',
  shifts: [],
  termStructure: [],
  sectionStrengthNorms: {
    optimal: 40,
    hardMax: 45,
    exemptionAllowed: false,
  },
};

const ATTENDANCE_OPTION_VALUES = ATTENDANCE_TYPE_VALUES;

export function InstituteConfigTab({ institute, loading }: InstituteConfigTabProps) {
  const t = useTranslations('instituteSettings');
  const tc = useTranslations('instituteSettings.config');
  const [updateConfig] = useUpdateInstituteConfig();

  const config = institute?.config;

  const form = useAppForm({
    defaultValues: DEFAULT_VALUES,
    validators: { onChange: instituteConfigSchema, onSubmit: instituteConfigSchema },
    onSubmit: async ({ value }) => {
      try {
        await updateConfig({
          variables: {
            input: {
              attendanceType: value.attendanceType,
              openingTime: value.openingTime,
              closingTime: value.closingTime,
              shifts: value.shifts,
              termStructure: value.termStructure,
              sectionStrengthNorms: value.sectionStrengthNorms,
            },
          },
        });
        toast.success(t('saved'));
      } catch (err) {
        toast.error(t('saveFailed'), {
          description: extractGraphQLError(err, t('saveFailed')),
        });
      }
    },
  });

  const isDirty = useStore(form.store, (state) => state.isDirty);

  // Dispatch dirty state to parent for beforeunload guard
  React.useEffect(() => {
    window.dispatchEvent(new CustomEvent('institute-form-dirty', { detail: { dirty: isDirty } }));
  }, [isDirty]);

  React.useEffect(() => {
    if (!config) return;
    form.reset(
      {
        attendanceType: (config.attendanceType as AttendanceType) ?? AttendanceType.DAILY,
        openingTime: config.openingTime ?? '08:00',
        closingTime: config.closingTime ?? '14:00',
        shifts: config.shifts ?? [],
        termStructure: config.termStructure ?? [],
        sectionStrengthNorms: config.sectionStrengthNorms ?? {
          optimal: 40,
          hardMax: 45,
          exemptionAllowed: false,
        },
      },
      { keepDefaultValues: true },
    );
  }, [config, form]);

  const attendanceOptions = ATTENDANCE_OPTION_VALUES.map((type) => ({
    value: type,
    label: tc(`attendanceOptions.${type}`),
  }));

  if (loading && !institute) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <Can I="update_config" a="Institute" passThrough>
      {(allowed: boolean) => (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{tc('title')}</CardTitle>
              <CardDescription>{tc('description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <form
                noValidate
                onSubmit={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void form.handleSubmit();
                }}
              >
                <fieldset disabled={!allowed}>
                  <FieldGroup>
                    <form.AppField name="attendanceType">
                      {(field) => (
                        <field.SelectField
                          label={tc('attendanceType')}
                          description={tc('attendanceTypeDescription')}
                          options={attendanceOptions}
                          optional={false}
                        />
                      )}
                    </form.AppField>

                    <FieldSeparator>{tc('operatingHours')}</FieldSeparator>
                    <FieldDescription>{tc('operatingHoursDescription')}</FieldDescription>
                    <div className="grid grid-cols-2 gap-4">
                      <form.AppField name="openingTime">
                        {(field) => (
                          <field.TextField label={tc('openingTime')} type="text" inputMode="text" />
                        )}
                      </form.AppField>
                      <form.AppField name="closingTime">
                        {(field) => (
                          <field.TextField label={tc('closingTime')} type="text" inputMode="text" />
                        )}
                      </form.AppField>
                    </div>

                    <FieldSeparator>{tc('shifts')}</FieldSeparator>
                    <FieldDescription>{tc('shiftsDescription')}</FieldDescription>
                    <ShiftsBuilder form={form} />

                    <FieldSeparator>{tc('gradingSystem')}</FieldSeparator>
                    <FieldDescription>{tc('gradingSystemDescription')}</FieldDescription>
                    {config?.gradingSystem ? (
                      <div className="rounded-lg border bg-muted/50 p-4">
                        <pre className="text-xs text-muted-foreground">
                          {JSON.stringify(config.gradingSystem, null, 2)}
                        </pre>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">—</p>
                    )}

                    <FieldSeparator>{tc('termStructure')}</FieldSeparator>
                    <FieldDescription>{tc('termStructureDescription')}</FieldDescription>
                    <TermStructureBuilder form={form} />

                    <FieldSeparator>{tc('sectionStrength')}</FieldSeparator>
                    <FieldDescription>{tc('sectionStrengthDescription')}</FieldDescription>
                    <div className="grid grid-cols-2 gap-4">
                      <form.AppField name="sectionStrengthNorms.optimal">
                        {(field) => (
                          <field.NumberField
                            label={tc('optimalStrength')}
                            description={tc('optimalStrengthDescription')}
                            min={1}
                          />
                        )}
                      </form.AppField>
                      <form.AppField name="sectionStrengthNorms.hardMax">
                        {(field) => (
                          <field.NumberField
                            label={tc('hardMax')}
                            description={tc('hardMaxDescription')}
                            min={1}
                          />
                        )}
                      </form.AppField>
                    </div>

                    <form.AppField name="sectionStrengthNorms.exemptionAllowed">
                      {(field) => (
                        <field.SwitchField
                          label={tc('exemptionAllowed')}
                          description={tc('exemptionAllowedDescription')}
                        />
                      )}
                    </form.AppField>

                    <FieldSeparator>{tc('notifications')}</FieldSeparator>
                    <div className="rounded-lg border border-dashed p-6 text-center">
                      <Badge variant="secondary">{t('comingSoon')}</Badge>
                    </div>
                  </FieldGroup>

                  {allowed && (
                    <div className="mt-6 flex justify-end">
                      <form.AppForm>
                        <form.SubmitButton disabled={!isDirty} submittingLabel={t('saving')}>
                          {t('save')}
                        </form.SubmitButton>
                      </form.AppForm>
                    </div>
                  )}
                </fieldset>
              </form>
            </CardContent>
          </Card>

          {!allowed && <p className="text-sm text-muted-foreground">{t('noPermission')}</p>}
        </div>
      )}
    </Can>
  );
}
