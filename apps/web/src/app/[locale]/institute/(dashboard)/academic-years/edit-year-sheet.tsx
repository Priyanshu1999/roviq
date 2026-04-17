'use client';

import { gql, useMutation } from '@roviq/graphql';
import { useFormatDate, zodValidator } from '@roviq/i18n';
import {
  Button,
  Can,
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldInfoPopover,
  FieldLabel,
  FieldLegend,
  FieldSet,
  fieldErrorMessages,
  Input,
  Separator,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Spinner,
  useAppForm,
} from '@roviq/ui';
import { useStore } from '@tanstack/react-form';
import { parseISO } from 'date-fns';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import type { AcademicYear } from './use-academic-years';

const UPDATE_ACADEMIC_YEAR = gql`
  mutation UpdateAcademicYear($id: ID!, $input: UpdateAcademicYearInput!) {
    updateAcademicYear(id: $id, input: $input) {
      id
      label
      startDate
      endDate
      termStructure { label startDate endDate }
    }
  }
`;

interface TermFormValue {
  label: string;
  startDate: string;
  endDate: string;
}

interface EditYearFormValues {
  label: string;
  startDate: string;
  endDate: string;
  terms: TermFormValue[];
}

interface EditYearSheetProps {
  year: AcademicYear | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DRAFT_KEY_PREFIX = 'roviq:draft:academic-year';
const AUTOSAVE_INTERVAL_MS = 30_000;

const DEFAULT_VALUES: EditYearFormValues = {
  label: '',
  startDate: '',
  endDate: '',
  terms: [],
};

function buildSchema(t: ReturnType<typeof useTranslations>) {
  const ISO = /^\d{4}-\d{2}-\d{2}$/;
  return z.object({
    label: z.string().min(1, t('labelRequired')),
    startDate: z.string().min(1, t('startDateRequired')).regex(ISO, t('startDateRequired')),
    endDate: z.string().min(1, t('endDateRequired')).regex(ISO, t('endDateRequired')),
    terms: z.array(
      z.object({
        label: z.string().min(1, t('termLabelRequired')),
        startDate: z.string().min(1, t('termDateRequired')),
        endDate: z.string().min(1, t('termDateRequired')),
      }),
    ),
  });
}

export function EditYearSheet({ year, open, onOpenChange }: EditYearSheetProps) {
  const t = useTranslations('academicYears');
  const tCommon = useTranslations('common');
  const { format } = useFormatDate();
  const [mutate, { loading }] = useMutation(UPDATE_ACADEMIC_YEAR, {
    refetchQueries: ['AcademicYears'],
  });

  const isReadOnly = year?.status === 'ARCHIVED';
  const draftKey = year ? `${DRAFT_KEY_PREFIX}:${year.id}` : null;

  const [draftRestored, setDraftRestored] = useState(false);
  const restoredDraftRef = useRef(false);

  const schema = useMemo(() => buildSchema(t), [t]);

  // Seed defaults from the supplied year so the form renders pre-filled on
  // first paint — useAppForm only reads `defaultValues` once at construction.
  // Subsequent year switches go through `resetToYear` in the effect below.
  // Cache via ref so the snapshot is taken from whatever `year` was on the
  // first render and never recomputed.
  const initialValuesRef = useRef<EditYearFormValues | null>(null);
  if (initialValuesRef.current === null) {
    initialValuesRef.current = year
      ? {
          label: year.label,
          startDate: year.startDate,
          endDate: year.endDate,
          terms: (Array.isArray(year.termStructure) ? year.termStructure : []).map((term) => ({
            label: term?.label ?? '',
            startDate: term?.startDate ?? '',
            endDate: term?.endDate ?? '',
          })),
        }
      : DEFAULT_VALUES;
  }

  const form = useAppForm({
    defaultValues: initialValuesRef.current,
    validators: { onChange: zodValidator(schema), onSubmit: zodValidator(schema) },
    onSubmit: async ({ value }) => {
      if (!year || isReadOnly) return;

      try {
        await mutate({
          variables: {
            id: year.id,
            input: {
              label: value.label.trim(),
              startDate: value.startDate,
              endDate: value.endDate,
              termStructure: value.terms,
            },
          },
        });
        clearDraft();
        setDraftRestored(false);
        toast.success(t('saved'));
        onOpenChange(false);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        toast.error(message);
      }
    },
  });

  // Subscribe to dates so the term-row min/max attributes track the parent
  // year span without each row re-reading the form on every keystroke.
  const startDate = useStore(
    form.store,
    (state) => (state.values as EditYearFormValues).startDate ?? '',
  );
  const endDate = useStore(
    form.store,
    (state) => (state.values as EditYearFormValues).endDate ?? '',
  );
  const isDirty = useStore(form.store, (state) => state.isDirty);

  const resetToYear = useCallback(
    (source: AcademicYear) => {
      form.reset({
        label: source.label,
        startDate: source.startDate,
        endDate: source.endDate,
        terms: (Array.isArray(source.termStructure) ? source.termStructure : []).map((term) => ({
          label: term?.label ?? '',
          startDate: term?.startDate ?? '',
          endDate: term?.endDate ?? '',
        })),
      });
    },
    [form],
  );

  // Populate form when year changes; restore draft if present.
  useEffect(() => {
    if (!year) return;
    resetToYear(year);
    restoredDraftRef.current = false;
    setDraftRestored(false);

    if (isReadOnly || typeof window === 'undefined' || !draftKey) return;

    try {
      const raw = window.localStorage.getItem(draftKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as EditYearFormValues;
      form.reset(parsed);
      restoredDraftRef.current = true;
      setDraftRestored(true);
    } catch {
      // Corrupt draft — ignore and fall back to server state.
    }
  }, [year, draftKey, isReadOnly, form, resetToYear]);

  // Auto-save draft every 30s and on every value change.
  useEffect(() => {
    if (!open || isReadOnly || !draftKey || typeof window === 'undefined') return;

    const persist = () => {
      if (!isDirty) return;
      try {
        window.localStorage.setItem(draftKey, JSON.stringify(form.store.state.values));
      } catch {
        // Quota exceeded or unavailable — silent.
      }
    };

    const interval = window.setInterval(persist, AUTOSAVE_INTERVAL_MS);
    const subscription = form.store.subscribe(() => persist());

    return () => {
      window.clearInterval(interval);
      subscription.unsubscribe();
    };
  }, [open, isReadOnly, draftKey, form, isDirty]);

  const clearDraft = useCallback(() => {
    if (typeof window === 'undefined' || !draftKey) return;
    try {
      window.localStorage.removeItem(draftKey);
    } catch {
      // ignore
    }
  }, [draftKey]);

  const handleDiscardDraft = () => {
    if (!year) return;
    clearDraft();
    resetToYear(year);
    setDraftRestored(false);
  };

  const sessionRange = useMemo(() => {
    if (!year) return '';
    return t('sessionRange', {
      range: `${format(parseISO(year.startDate), 'dd/MM/yyyy')} — ${format(
        parseISO(year.endDate),
        'dd/MM/yyyy',
      )}`,
    });
  }, [year, format, t]);

  if (!year) return null;

  const createdOn = t('createdOn', {
    date: format(parseISO(year.createdAt), 'dd MMM yyyy'),
  });
  const updatedOn = t('updatedOn', {
    date: format(parseISO(year.updatedAt), 'dd MMM yyyy'),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        data-testid="academic-years-edit-sheet"
        className="flex flex-col gap-0 overflow-hidden p-0 sm:max-w-xl"
        aria-busy={loading}
      >
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>{t('editTitle')}</SheetTitle>
          <SheetDescription>{t('editDescription')}</SheetDescription>
          <p className="mt-1 text-xs text-muted-foreground">{sessionRange}</p>
          {isReadOnly && (
            <output className="mt-2 block rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {t('readOnlyNotice')}
            </output>
          )}
        </SheetHeader>

        {draftRestored && !isReadOnly && (
          <output
            className="flex items-start justify-between gap-3 border-b bg-muted/40 px-6 py-3"
            aria-live="polite"
          >
            <div className="text-xs">
              <p className="font-medium">{t('draftRestoredTitle')}</p>
              <p className="text-muted-foreground">{t('draftRestoredDescription')}</p>
            </div>
            <Button
              data-testid="academic-years-edit-discard-draft-btn"
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleDiscardDraft}
            >
              {t('discardDraft')}
            </Button>
          </output>
        )}

        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void form.handleSubmit();
          }}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
            {/* Read-only metadata (FVOLK) */}
            <section
              aria-label={t('editTitle')}
              className="space-y-1 text-xs text-muted-foreground"
            >
              <p>{createdOn}</p>
              <p>{updatedOn}</p>
            </section>

            <Separator />

            <FieldSet disabled={isReadOnly}>
              <FieldLegend className="sr-only">{t('editTitle')}</FieldLegend>

              <FieldGroup>
                <form.AppField name="label">
                  {(field) => {
                    const errors = fieldErrorMessages(field);
                    const invalid = errors.length > 0;
                    const value = typeof field.state.value === 'string' ? field.state.value : '';
                    return (
                      <Field data-invalid={invalid || undefined}>
                        <span className="flex items-center gap-2">
                          <FieldLabel htmlFor={field.name}>{t('label')}</FieldLabel>
                          <FieldInfoPopover
                            title={t('fieldHelp.labelTitle')}
                            data-testid="academic-years-edit-label-info"
                          >
                            <p>{t('fieldHelp.labelBody')}</p>
                            <p>
                              <em>{t('fieldHelp.labelExample')}</em>
                            </p>
                          </FieldInfoPopover>
                        </span>
                        <FieldDescription>{t('labelDescription')}</FieldDescription>
                        <Input
                          id={field.name}
                          name={field.name}
                          data-testid="academic-years-edit-label-input"
                          value={value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          onBlur={field.handleBlur}
                          placeholder={t('labelPlaceholder')}
                          aria-invalid={invalid || undefined}
                          aria-describedby={`${field.name}-hint`}
                        />
                        <FieldDescription id={`${field.name}-hint`}>
                          {t('labelFormatHint')}
                        </FieldDescription>
                        {invalid && (
                          <FieldError
                            data-testid="academic-years-edit-label-error"
                            errors={errors}
                          />
                        )}
                      </Field>
                    );
                  }}
                </form.AppField>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <form.AppField name="startDate">
                    {(field) => {
                      const errors = fieldErrorMessages(field);
                      const invalid = errors.length > 0;
                      const value = typeof field.state.value === 'string' ? field.state.value : '';
                      return (
                        <Field data-invalid={invalid || undefined}>
                          <FieldLabel htmlFor={field.name}>{t('startDate')}</FieldLabel>
                          <FieldDescription>{t('startDateDescription')}</FieldDescription>
                          <Input
                            id={field.name}
                            name={field.name}
                            data-testid="academic-years-edit-start-date-input"
                            type="date"
                            value={value}
                            onChange={(e) => field.handleChange(e.target.value)}
                            onBlur={field.handleBlur}
                            aria-invalid={invalid || undefined}
                            aria-describedby={`${field.name}-hint`}
                          />
                          <FieldDescription id={`${field.name}-hint`}>
                            {t('dateFormatHint')}
                          </FieldDescription>
                          {invalid && (
                            <FieldError
                              data-testid="academic-years-edit-start-date-error"
                              errors={errors}
                            />
                          )}
                        </Field>
                      );
                    }}
                  </form.AppField>

                  <form.AppField name="endDate">
                    {(field) => {
                      const errors = fieldErrorMessages(field);
                      const invalid = errors.length > 0;
                      const value = typeof field.state.value === 'string' ? field.state.value : '';
                      return (
                        <Field data-invalid={invalid || undefined}>
                          <FieldLabel htmlFor={field.name}>{t('endDate')}</FieldLabel>
                          <FieldDescription>{t('endDateDescription')}</FieldDescription>
                          <Input
                            id={field.name}
                            name={field.name}
                            data-testid="academic-years-edit-end-date-input"
                            type="date"
                            value={value}
                            onChange={(e) => field.handleChange(e.target.value)}
                            onBlur={field.handleBlur}
                            min={startDate || undefined}
                            aria-invalid={invalid || undefined}
                            aria-describedby={`${field.name}-hint`}
                          />
                          <FieldDescription id={`${field.name}-hint`}>
                            {t('dateFormatHint')}
                          </FieldDescription>
                          {invalid && (
                            <FieldError
                              data-testid="academic-years-edit-end-date-error"
                              errors={errors}
                            />
                          )}
                        </Field>
                      );
                    }}
                  </form.AppField>
                </div>
              </FieldGroup>
            </FieldSet>

            <Separator />

            <FieldSet disabled={isReadOnly}>
              <form.Field name="terms" mode="array">
                {(arrayField) => {
                  const terms = arrayField.state.value as ReadonlyArray<unknown>;
                  return (
                    <>
                      <div className="flex items-center justify-between">
                        <FieldLegend className="flex items-center gap-2">
                          {t('termStructure')}
                          <FieldInfoPopover
                            title={t('fieldHelp.termStructureTitle')}
                            data-testid="academic-years-edit-term-structure-info"
                          >
                            <p>{t('fieldHelp.termStructureBody')}</p>
                            <p>{t('fieldHelp.termStructureCommonChoices')}</p>
                          </FieldInfoPopover>
                        </FieldLegend>
                        {!isReadOnly && (
                          <Button
                            data-testid="academic-years-edit-add-term-btn"
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              arrayField.pushValue({ label: '', startDate: '', endDate: '' })
                            }
                            className="gap-1.5"
                            title={t('addTerm')}
                          >
                            <Plus className="size-3.5" aria-hidden="true" />
                            {t('addTerm')}
                          </Button>
                        )}
                      </div>

                      {terms.length === 0 ? (
                        <p className="mt-2 text-sm text-muted-foreground">{t('termsEmpty')}</p>
                      ) : (
                        <FieldGroup className="mt-3 space-y-3">
                          {terms.map((_, index) => (
                            <div
                              // biome-ignore lint/suspicious/noArrayIndexKey: array order is the only stable identity for these rows.
                              key={index}
                              className="rounded-lg border border-border/60 bg-muted/30 p-3"
                            >
                              <div className="flex items-start gap-2">
                                <form.AppField name={`terms[${index}].label`}>
                                  {(field) => {
                                    const errors = fieldErrorMessages(field);
                                    const invalid = errors.length > 0;
                                    const value =
                                      typeof field.state.value === 'string'
                                        ? field.state.value
                                        : '';
                                    return (
                                      <Field data-invalid={invalid || undefined} className="flex-1">
                                        <FieldLabel htmlFor={field.name} className="sr-only">
                                          {t('termLabelAria', { index: index + 1 })}
                                        </FieldLabel>
                                        <Input
                                          id={field.name}
                                          name={field.name}
                                          data-testid={`academic-years-edit-term-${index}-label-input`}
                                          value={value}
                                          onChange={(e) => field.handleChange(e.target.value)}
                                          onBlur={field.handleBlur}
                                          placeholder={t('termLabelPlaceholder')}
                                          aria-invalid={invalid || undefined}
                                        />
                                        {invalid && (
                                          <FieldError
                                            data-testid={`academic-years-edit-term-${index}-label-error`}
                                            errors={errors}
                                          />
                                        )}
                                      </Field>
                                    );
                                  }}
                                </form.AppField>
                                {!isReadOnly && (
                                  <Button
                                    data-testid={`academic-years-edit-term-${index}-remove-btn`}
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => arrayField.removeValue(index)}
                                    className="size-9 p-0 text-muted-foreground hover:text-destructive"
                                    title={t('removeTerm')}
                                    aria-label={t('removeTermAria', { index: index + 1 })}
                                  >
                                    <Trash2 className="size-4" aria-hidden="true" />
                                  </Button>
                                )}
                              </div>

                              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                                <form.AppField name={`terms[${index}].startDate`}>
                                  {(field) => {
                                    const errors = fieldErrorMessages(field);
                                    const invalid = errors.length > 0;
                                    const value =
                                      typeof field.state.value === 'string'
                                        ? field.state.value
                                        : '';
                                    return (
                                      <Field data-invalid={invalid || undefined}>
                                        <FieldLabel htmlFor={field.name}>
                                          {t('termStart')}
                                        </FieldLabel>
                                        <Input
                                          id={field.name}
                                          name={field.name}
                                          data-testid={`academic-years-edit-term-${index}-start-date-input`}
                                          type="date"
                                          value={value}
                                          onChange={(e) => field.handleChange(e.target.value)}
                                          onBlur={field.handleBlur}
                                          min={startDate || undefined}
                                          max={endDate || undefined}
                                          aria-invalid={invalid || undefined}
                                          aria-label={t('termStartAria', {
                                            index: index + 1,
                                          })}
                                        />
                                        {invalid && (
                                          <FieldError
                                            data-testid={`academic-years-edit-term-${index}-start-date-error`}
                                            errors={errors}
                                          />
                                        )}
                                      </Field>
                                    );
                                  }}
                                </form.AppField>
                                <form.AppField name={`terms[${index}].endDate`}>
                                  {(field) => {
                                    const errors = fieldErrorMessages(field);
                                    const invalid = errors.length > 0;
                                    const value =
                                      typeof field.state.value === 'string'
                                        ? field.state.value
                                        : '';
                                    const termStart =
                                      (form.store.state.values as EditYearFormValues).terms[index]
                                        ?.startDate ?? '';
                                    return (
                                      <Field data-invalid={invalid || undefined}>
                                        <FieldLabel htmlFor={field.name}>{t('termEnd')}</FieldLabel>
                                        <Input
                                          id={field.name}
                                          name={field.name}
                                          data-testid={`academic-years-edit-term-${index}-end-date-input`}
                                          type="date"
                                          value={value}
                                          onChange={(e) => field.handleChange(e.target.value)}
                                          onBlur={field.handleBlur}
                                          min={termStart || undefined}
                                          max={endDate || undefined}
                                          aria-invalid={invalid || undefined}
                                          aria-label={t('termEndAria', {
                                            index: index + 1,
                                          })}
                                        />
                                        {invalid && (
                                          <FieldError
                                            data-testid={`academic-years-edit-term-${index}-end-date-error`}
                                            errors={errors}
                                          />
                                        )}
                                      </Field>
                                    );
                                  }}
                                </form.AppField>
                              </div>
                            </div>
                          ))}
                        </FieldGroup>
                      )}
                    </>
                  );
                }}
              </form.Field>
            </FieldSet>
          </div>

          <SheetFooter className="sticky bottom-0 border-t bg-background px-6 py-4">
            <Button
              data-testid="academic-years-edit-cancel-btn"
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              {tCommon('cancel')}
            </Button>
            {!isReadOnly && (
              <Can I="update" a="AcademicYear">
                <Button
                  data-testid="academic-years-edit-save-btn"
                  type="submit"
                  disabled={loading}
                  aria-busy={loading}
                >
                  {loading && <Spinner className="me-2 size-4" aria-hidden="true" />}
                  {loading ? t('saving') : t('save')}
                </Button>
              </Can>
            )}
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
