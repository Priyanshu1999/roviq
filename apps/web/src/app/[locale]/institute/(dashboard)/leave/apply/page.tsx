'use client';

import { useAuth } from '@roviq/auth';
import { extractGraphQLError } from '@roviq/graphql';
import { useI18nField, useRouter, zodValidator } from '@roviq/i18n';
import {
  Button,
  Can,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  Popover,
  PopoverContent,
  PopoverTrigger,
  useAppForm,
  useDebounce,
} from '@roviq/ui';
import { ArrowLeft, Check, ChevronsUpDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { useStudents } from '../../people/students/use-students';
import { LEAVE_TYPE_VALUES, type LeaveType, useApplyLeave } from '../use-leave';

const { instituteLeave } = testIds;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const REASON_MAX = 1000;

interface ApplyLeaveFormValues {
  userId: string;
  type: LeaveType | '';
  startDate: string;
  endDate: string;
  reason: string;
  fileUrlsText: string;
}

const EMPTY_FORM: ApplyLeaveFormValues = {
  userId: '',
  type: '',
  startDate: '',
  endDate: '',
  reason: '',
  fileUrlsText: '',
};

function parseFileUrls(text: string): string[] {
  return text
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function daysBetween(start: string, end: string): number {
  // Inclusive day span — a 1-day leave has start===end and spans 1 day.
  // Parses without timezones so +05:30 can't drift the count.
  const [sy, sm, sd] = start.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);
  const s = new Date(sy ?? 1970, (sm ?? 1) - 1, sd ?? 1).getTime();
  const e = new Date(ey ?? 1970, (em ?? 1) - 1, ed ?? 1).getTime();
  return Math.round((e - s) / 86_400_000) + 1;
}

function buildSchema(t: ReturnType<typeof useTranslations>) {
  return z
    .object({
      userId: z.string().uuid(t('fields.userId')),
      type: z.enum(LEAVE_TYPE_VALUES),
      startDate: z.string().regex(ISO_DATE_REGEX, t('fields.startDate')),
      endDate: z.string().regex(ISO_DATE_REGEX, t('fields.endDate')),
      reason: z.string().trim().min(1, t('fields.reason')).max(REASON_MAX),
      fileUrlsText: z.string(),
    })
    .refine((d) => d.startDate <= d.endDate, {
      path: ['endDate'],
      message: t('errors.END_BEFORE_START'),
    })
    .refine(
      (d) => {
        const days = daysBetween(d.startDate, d.endDate);
        if (days <= 2) return true;
        return parseFileUrls(d.fileUrlsText).length >= 1;
      },
      {
        path: ['fileUrlsText'],
        message: t('errors.FILES_REQUIRED_GT2_DAYS'),
      },
    );
}

export default function ApplyLeavePage() {
  const t = useTranslations('leave');
  const router = useRouter();
  const { user } = useAuth();
  const { apply } = useApplyLeave();

  const schema = React.useMemo(() => buildSchema(t), [t]);

  const form = useAppForm({
    defaultValues: {
      ...EMPTY_FORM,
      // Prefill the applicant as the logged-in user — admins picking
      // on behalf of a student can still overwrite via the picker.
      userId: user?.membershipId ?? '',
    } satisfies ApplyLeaveFormValues,
    validators: { onChange: zodValidator(schema), onSubmit: zodValidator(schema) },
    onSubmit: async ({ value }) => {
      const parsed = schema.parse(value);
      try {
        await apply({
          userId: parsed.userId,
          type: parsed.type as LeaveType,
          startDate: parsed.startDate,
          endDate: parsed.endDate,
          reason: parsed.reason,
          fileUrls: parseFileUrls(parsed.fileUrlsText),
        });
        toast.success(t('apply.cta'));
        router.push('/institute/leave');
      } catch (err) {
        toast.error(extractGraphQLError(err, t('apply.cta')));
      }
    },
  });

  const handleCancel = () => router.push('/institute/leave');

  const typeOptions = LEAVE_TYPE_VALUES.map((v) => ({ value: v, label: t(`type.${v}`) }));

  return (
    <Can I="create" a="Leave" passThrough>
      {(allowed: boolean) =>
        allowed ? (
          <div className="mx-auto max-w-2xl space-y-6">
            <header className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <h1
                  className="text-2xl font-bold tracking-tight"
                  data-testid={instituteLeave.applyTitle}
                >
                  {t('apply.title')}
                </h1>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                data-testid={instituteLeave.applyBackBtn}
              >
                <ArrowLeft className="size-4" aria-hidden="true" />
                {t('detail.back')}
              </Button>
            </header>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void form.handleSubmit();
              }}
              noValidate
              className="space-y-6"
            >
              <FieldGroup>
                <form.Field name="userId">
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor="leave-apply-user-picker">
                        {t('fields.userId')}
                      </FieldLabel>
                      <MembershipPicker
                        value={typeof field.state.value === 'string' ? field.state.value : ''}
                        onChange={(v) => field.handleChange(v)}
                      />
                      {field.state.meta.isTouched && field.state.meta.errors.length > 0 ? (
                        <FieldError
                          errors={collectMessages(field.state.meta.errors).map((m) => ({
                            message: m,
                          }))}
                        />
                      ) : null}
                    </Field>
                  )}
                </form.Field>

                <form.AppField name="type">
                  {(field) => (
                    <field.SelectField
                      label={t('fields.type')}
                      options={typeOptions}
                      placeholder={t('fields.type')}
                      testId="leave-apply-type-select"
                    />
                  )}
                </form.AppField>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <form.AppField name="startDate">
                    {(field) => (
                      <field.DateField
                        label={t('fields.startDate')}
                        testId="leave-apply-start-date"
                      />
                    )}
                  </form.AppField>
                  <form.AppField name="endDate">
                    {(field) => (
                      <field.DateField label={t('fields.endDate')} testId="leave-apply-end-date" />
                    )}
                  </form.AppField>
                </div>

                <form.AppField name="reason">
                  {(field) => (
                    <field.TextareaField
                      label={t('fields.reason')}
                      maxLength={REASON_MAX}
                      rows={4}
                      testId="leave-apply-reason"
                    />
                  )}
                </form.AppField>

                <form.AppField name="fileUrlsText">
                  {(field) => (
                    <field.TextField
                      label={t('fields.fileUrls')}
                      description={t('fields.fileUrlsHint')}
                      placeholder="https://…, https://…"
                      testId="leave-apply-file-urls"
                    />
                  )}
                </form.AppField>
                {/* TODO(leave-upload): swap the comma-separated text input
                    for a real file picker that uploads to MinIO/S3 and
                    returns object URLs, matching the pattern used by
                    `uploadStudentDocument`. */}
                <FieldDescription className="text-xs">
                  {/* extra hint rendered beside the text input */}
                </FieldDescription>
              </FieldGroup>

              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  data-testid={instituteLeave.applyCancelBtn}
                >
                  {t('detail.back')}
                </Button>
                <form.AppForm>
                  <form.SubmitButton
                    testId="leave-apply-submit-btn"
                    submittingLabel={t('apply.submitting')}
                  >
                    {t('apply.cta')}
                  </form.SubmitButton>
                </form.AppForm>
              </div>
            </form>
          </div>
        ) : (
          <div className="flex items-center justify-center min-h-[400px]">
            <p className="text-muted-foreground" data-testid={instituteLeave.applyAccessDenied}>
              {t('accessDenied')}
            </p>
          </div>
        )
      }
    </Can>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Membership picker — reuses the student list like the attendance
// history picker. See note in `page.tsx` re: staff membership gap.
// ─────────────────────────────────────────────────────────────────────

function MembershipPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const t = useTranslations('leave');
  const resolveI18n = useI18nField();
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebounce(search, 250);

  const { students } = useStudents({ first: 50, search: debouncedSearch || undefined });

  const selectedLabel = React.useMemo(() => {
    if (!value) return null;
    const stu = students.find((s) => s.id === value);
    if (!stu) return value.slice(0, 8);
    const first = resolveI18n(stu.firstName) ?? '';
    const last = stu.lastName ? (resolveI18n(stu.lastName) ?? '') : '';
    return `${[first, last].filter(Boolean).join(' ')} · ${stu.admissionNumber}`.trim();
  }, [value, students, resolveI18n]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id="leave-apply-user-picker"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          data-testid={instituteLeave.applyUserPicker}
        >
          <span className="truncate">{selectedLabel ?? t('fields.userId')}</span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={t('fields.userId')}
            value={search}
            onValueChange={setSearch}
            data-testid={instituteLeave.applyUserPickerInput}
          />
          <CommandList>
            <CommandEmpty>{t('fields.userId')}</CommandEmpty>
            <CommandGroup>
              {students.map((stu) => {
                const first = resolveI18n(stu.firstName) ?? '';
                const last = stu.lastName ? (resolveI18n(stu.lastName) ?? '') : '';
                const label = `${[first, last].filter(Boolean).join(' ')} · ${stu.admissionNumber}`;
                return (
                  <CommandItem
                    key={stu.id}
                    value={stu.id}
                    onSelect={() => {
                      onChange(stu.id);
                      setOpen(false);
                    }}
                    data-testid={`leave-apply-user-option-${stu.id}`}
                  >
                    <Check
                      className={`mr-2 size-4 ${value === stu.id ? 'opacity-100' : 'opacity-0'}`}
                    />
                    {label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function collectMessages(errors: ReadonlyArray<unknown>): string[] {
  const out: string[] = [];
  for (const err of errors) {
    if (err == null) continue;
    if (typeof err === 'string') {
      if (err.length > 0) out.push(err);
      continue;
    }
    if (typeof err === 'object' && 'message' in err) {
      const msg = (err as { message?: unknown }).message;
      if (typeof msg === 'string' && msg.length > 0) out.push(msg);
    }
  }
  return out;
}

import { testIds } from '@roviq/ui/testing/testid-registry';
