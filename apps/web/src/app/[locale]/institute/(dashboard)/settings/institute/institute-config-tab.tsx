'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { extractGraphQLError } from '@roviq/graphql';
import {
  Badge,
  Button,
  Can,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Switch,
} from '@roviq/ui';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { FormProvider, type Resolver, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { ShiftsBuilder } from './components/shifts-builder';
import { TermStructureBuilder } from './components/term-structure-builder';
import { type InstituteConfigFormValues, instituteConfigSchema } from './schemas';
import type { MyInstituteData } from './types';
import { useUpdateInstituteConfig } from './use-institute-settings';

const ATTENDANCE_TYPES = ['daily', 'lecture_wise'] as const;

interface InstituteConfigTabProps {
  institute: MyInstituteData['myInstitute'] | undefined;
  loading: boolean;
}

export function InstituteConfigTab({ institute, loading }: InstituteConfigTabProps) {
  const t = useTranslations('instituteSettings');
  const tc = useTranslations('instituteSettings.config');
  const [updateConfig] = useUpdateInstituteConfig();

  const config = institute?.config;

  const form = useForm<InstituteConfigFormValues>({
    resolver: zodResolver(instituteConfigSchema) as Resolver<InstituteConfigFormValues>,
    defaultValues: {
      attendanceType: 'daily',
      openingTime: '08:00',
      closingTime: '14:00',
      shifts: [],
      termStructure: [],
      sectionStrengthNorms: {
        optimal: 40,
        hard_max: 45,
        exemption_allowed: false,
      },
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = form;

  React.useEffect(() => {
    if (!config) return;
    reset({
      attendanceType: (config.attendanceType as 'daily' | 'lecture_wise') ?? 'daily',
      openingTime: config.openingTime ?? '08:00',
      closingTime: config.closingTime ?? '14:00',
      shifts: config.shifts ?? [],
      termStructure: config.termStructure ?? [],
      sectionStrengthNorms: config.sectionStrengthNorms ?? {
        optimal: 40,
        hard_max: 45,
        exemption_allowed: false,
      },
    });
  }, [config, reset]);

  const onSubmit = async (values: InstituteConfigFormValues) => {
    try {
      await updateConfig({
        variables: {
          input: {
            attendanceType: values.attendanceType,
            openingTime: values.openingTime,
            closingTime: values.closingTime,
            shifts: values.shifts,
            termStructure: values.termStructure,
            sectionStrengthNorms: values.sectionStrengthNorms,
          },
        },
      });
      toast.success(t('saved'));
    } catch (err) {
      toast.error(t('saveFailed'), {
        description: extractGraphQLError(err, t('saveFailed')),
      });
    }
  };

  const currentAttendanceType = watch('attendanceType');
  const exemptionAllowed = watch('sectionStrengthNorms.exemption_allowed');

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
              <FormProvider {...form}>
                <form onSubmit={handleSubmit(onSubmit)}>
                  <fieldset disabled={!allowed || isSubmitting}>
                    <FieldGroup>
                      {/* Attendance type */}
                      <Field>
                        <FieldLabel>{tc('attendanceType')}</FieldLabel>
                        <FieldDescription>{tc('attendanceTypeDescription')}</FieldDescription>
                        <Select
                          value={currentAttendanceType}
                          onValueChange={(v) =>
                            setValue('attendanceType', v as 'daily' | 'lecture_wise', {
                              shouldDirty: true,
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ATTENDANCE_TYPES.map((type) => (
                              <SelectItem key={type} value={type}>
                                {tc(`attendanceOptions.${type}`)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>

                      {/* Operating hours */}
                      <FieldSeparator>{tc('operatingHours')}</FieldSeparator>
                      <FieldDescription>{tc('operatingHoursDescription')}</FieldDescription>
                      <div className="grid grid-cols-2 gap-4">
                        <Field>
                          <FieldLabel htmlFor="opening-time">{tc('openingTime')}</FieldLabel>
                          <Input id="opening-time" type="time" {...register('openingTime')} />
                        </Field>
                        <Field>
                          <FieldLabel htmlFor="closing-time">{tc('closingTime')}</FieldLabel>
                          <Input id="closing-time" type="time" {...register('closingTime')} />
                        </Field>
                      </div>

                      {/* Shifts */}
                      <FieldSeparator>{tc('shifts')}</FieldSeparator>
                      <FieldDescription>{tc('shiftsDescription')}</FieldDescription>
                      <ShiftsBuilder />

                      {/* Grading system (read-only) */}
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

                      {/* Term structure */}
                      <FieldSeparator>{tc('termStructure')}</FieldSeparator>
                      <FieldDescription>{tc('termStructureDescription')}</FieldDescription>
                      <TermStructureBuilder />

                      {/* Section strength norms */}
                      <FieldSeparator>{tc('sectionStrength')}</FieldSeparator>
                      <FieldDescription>{tc('sectionStrengthDescription')}</FieldDescription>
                      <div className="grid grid-cols-2 gap-4">
                        <Field data-invalid={!!errors.sectionStrengthNorms?.optimal}>
                          <FieldLabel htmlFor="optimal-strength">
                            {tc('optimalStrength')}
                          </FieldLabel>
                          <FieldDescription>{tc('optimalStrengthDescription')}</FieldDescription>
                          <Input
                            id="optimal-strength"
                            type="number"
                            min="1"
                            {...register('sectionStrengthNorms.optimal', {
                              valueAsNumber: true,
                            })}
                            aria-invalid={!!errors.sectionStrengthNorms?.optimal}
                          />
                          {errors.sectionStrengthNorms?.optimal && (
                            <FieldError errors={[errors.sectionStrengthNorms.optimal]} />
                          )}
                        </Field>

                        <Field data-invalid={!!errors.sectionStrengthNorms?.hard_max}>
                          <FieldLabel htmlFor="hard-max">{tc('hardMax')}</FieldLabel>
                          <FieldDescription>{tc('hardMaxDescription')}</FieldDescription>
                          <Input
                            id="hard-max"
                            type="number"
                            min="1"
                            {...register('sectionStrengthNorms.hard_max', {
                              valueAsNumber: true,
                            })}
                            aria-invalid={!!errors.sectionStrengthNorms?.hard_max}
                          />
                          {errors.sectionStrengthNorms?.hard_max && (
                            <FieldError errors={[errors.sectionStrengthNorms.hard_max]} />
                          )}
                        </Field>
                      </div>

                      <Field>
                        <div className="flex items-center justify-between">
                          <div>
                            <FieldLabel>{tc('exemptionAllowed')}</FieldLabel>
                            <FieldDescription>{tc('exemptionAllowedDescription')}</FieldDescription>
                          </div>
                          <Switch
                            checked={exemptionAllowed}
                            onCheckedChange={(v) =>
                              setValue('sectionStrengthNorms.exemption_allowed', v, {
                                shouldDirty: true,
                              })
                            }
                          />
                        </div>
                      </Field>

                      {/* Notifications placeholder */}
                      <FieldSeparator>{tc('notifications')}</FieldSeparator>
                      <div className="rounded-lg border border-dashed p-6 text-center">
                        <Badge variant="secondary">{t('comingSoon')}</Badge>
                      </div>
                    </FieldGroup>

                    {allowed && (
                      <div className="mt-6 flex justify-end">
                        <Button type="submit" disabled={!isDirty || isSubmitting}>
                          {isSubmitting ? (
                            <>
                              <Loader2 className="size-4 animate-spin" />
                              {t('saving')}
                            </>
                          ) : (
                            t('save')
                          )}
                        </Button>
                      </div>
                    )}
                  </fieldset>
                </form>
              </FormProvider>
            </CardContent>
          </Card>

          {!allowed && <p className="text-sm text-muted-foreground">{t('noPermission')}</p>}
        </div>
      )}
    </Can>
  );
}
