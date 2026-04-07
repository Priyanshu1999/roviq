'use client';

import { gql, useMutation } from '@roviq/graphql';
import { useFormatDate } from '@roviq/i18n';
import {
  Button,
  Can,
  Field,
  FieldGroup,
  FieldLabel,
  Input,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@roviq/ui';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { AcademicYear } from './use-academic-years';

const UPDATE_ACADEMIC_YEAR = gql`
  mutation UpdateAcademicYear($id: ID!, $input: UpdateAcademicYearInput!) {
    updateAcademicYear(id: $id, input: $input) {
      id
      label
      startDate
      endDate
      termStructure
    }
  }
`;

interface EditYearForm {
  label: string;
  startDate: string;
  endDate: string;
  terms: Array<{ label: string; startDate: string; endDate: string }>;
}

interface EditYearSheetProps {
  year: AcademicYear | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditYearSheet({ year, open, onOpenChange }: EditYearSheetProps) {
  const t = useTranslations('academicYears');
  const { format } = useFormatDate();
  const [mutate, { loading }] = useMutation(UPDATE_ACADEMIC_YEAR, {
    refetchQueries: ['AcademicYears'],
  });

  const isReadOnly = year?.status === 'ARCHIVED';

  const form = useForm<EditYearForm>({
    defaultValues: {
      label: '',
      startDate: '',
      endDate: '',
      terms: [],
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'terms' });

  // Populate form when year changes
  useEffect(() => {
    if (year) {
      form.reset({
        label: year.label,
        startDate: year.startDate,
        endDate: year.endDate,
        terms: year.termStructure ?? [],
      });
    }
  }, [year, form]);

  const onSubmit = async (data: EditYearForm) => {
    if (!year || isReadOnly) return;

    try {
      await mutate({
        variables: {
          id: year.id,
          input: {
            label: data.label,
            startDate: data.startDate,
            endDate: data.endDate,
            termStructure: data.terms,
          },
        },
      });
      toast.success(t('saved'));
      onOpenChange(false);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  if (!year) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{year.label}</SheetTitle>
          <SheetDescription>
            {format(new Date(year.startDate), 'dd MMM yyyy')} —{' '}
            {format(new Date(year.endDate), 'dd MMM yyyy')}
            {isReadOnly && (
              <span className="ms-2 text-xs text-muted-foreground italic">
                ({t('status.ARCHIVED')} — read-only)
              </span>
            )}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 mt-6">
          <FieldGroup>
            <Field>
              <FieldLabel>{t('label')}</FieldLabel>
              <Input {...form.register('label')} disabled={isReadOnly} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel>{t('startDate')}</FieldLabel>
                <Input type="date" {...form.register('startDate')} disabled={isReadOnly} />
              </Field>
              <Field>
                <FieldLabel>{t('endDate')}</FieldLabel>
                <Input type="date" {...form.register('endDate')} disabled={isReadOnly} />
              </Field>
            </div>
          </FieldGroup>

          {/* Terms */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <FieldLabel className="text-sm font-medium">{t('termStructure')}</FieldLabel>
              {!isReadOnly && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ label: '', startDate: '', endDate: '' })}
                  className="gap-1.5 text-xs"
                >
                  <Plus className="size-3" />
                  {t('addTerm')}
                </Button>
              )}
            </div>

            {fields.length === 0 && (
              <p className="text-sm text-muted-foreground">{t('terms', { count: 0 })}</p>
            )}

            {fields.map((field, index) => (
              <div key={field.id} className="rounded-lg border bg-muted/30 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder={t('termLabelPlaceholder')}
                    className="flex-1 h-8 text-sm"
                    disabled={isReadOnly}
                    {...form.register(`terms.${index}.label`)}
                  />
                  {!isReadOnly && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => remove(index)}
                      className="size-8 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[11px] text-muted-foreground">{t('termStart')}</span>
                    <Input
                      type="date"
                      className="h-8 text-sm"
                      disabled={isReadOnly}
                      {...form.register(`terms.${index}.startDate`)}
                    />
                  </div>
                  <div>
                    <span className="text-[11px] text-muted-foreground">{t('termEnd')}</span>
                    <Input
                      type="date"
                      className="h-8 text-sm"
                      disabled={isReadOnly}
                      {...form.register(`terms.${index}.endDate`)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {!isReadOnly && (
            <SheetFooter>
              <Can I="update" a="AcademicYear">
                <Button type="submit" disabled={loading}>
                  {loading ? t('saving') : t('save')}
                </Button>
              </Can>
            </SheetFooter>
          )}
        </form>
      </SheetContent>
    </Sheet>
  );
}
