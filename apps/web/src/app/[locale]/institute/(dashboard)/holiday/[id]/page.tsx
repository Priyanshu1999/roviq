'use client';

import { extractGraphQLError } from '@roviq/graphql';
import { i18nTextSchema, useRouter, zodValidator } from '@roviq/i18n';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Can,
  Card,
  CardContent,
  FieldGroup,
  I18nField,
  useAppForm,
} from '@roviq/ui';
import { testIds } from '@roviq/ui/testing/testid-registry';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  HOLIDAY_TYPE_VALUES,
  type HolidayRecord,
  type HolidayType,
  useDeleteHoliday,
  useHoliday,
  useUpdateHoliday,
} from '../use-holiday';

const { instituteHoliday } = testIds;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const DESCRIPTION_MAX = 2000;

interface HolidayFormValues {
  name: Record<string, string>;
  description: string;
  type: HolidayType | '';
  startDate: string;
  endDate: string;
  tagsText: string;
  isPublic: boolean;
}

function parseTags(text: string): string[] {
  return text
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function buildSchema(t: ReturnType<typeof useTranslations>) {
  return z
    .object({
      name: i18nTextSchema,
      description: z.string().max(DESCRIPTION_MAX),
      type: z.enum(HOLIDAY_TYPE_VALUES),
      startDate: z.string().regex(ISO_DATE_REGEX, t('fields.startDate')),
      endDate: z.string().regex(ISO_DATE_REGEX, t('fields.endDate')),
      tagsText: z.string(),
      isPublic: z.boolean(),
    })
    .refine((d) => d.startDate <= d.endDate, {
      path: ['endDate'],
      message: t('errors.END_BEFORE_START'),
    });
}

export default function EditHolidayPage() {
  const t = useTranslations('holiday');
  const params = useParams();
  const id = params.id as string;
  const { holiday, loading } = useHoliday(id);

  return (
    <Can I="read" a="Holiday" passThrough>
      {(allowed: boolean) =>
        allowed ? (
          <div className="mx-auto max-w-2xl space-y-6">
            {loading && !holiday ? (
              <Card>
                <CardContent className="p-6">
                  <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
                </CardContent>
              </Card>
            ) : holiday ? (
              <EditHolidayForm holiday={holiday} />
            ) : null}
          </div>
        ) : (
          <div className="flex items-center justify-center min-h-[400px]">
            <p className="text-muted-foreground" data-testid={instituteHoliday.editAccessDenied}>
              {t('accessDenied')}
            </p>
          </div>
        )
      }
    </Can>
  );
}

function EditHolidayForm({ holiday }: { holiday: HolidayRecord }) {
  const t = useTranslations('holiday');
  const router = useRouter();
  const { mutate: updateHoliday } = useUpdateHoliday();
  const { mutate: deleteHoliday, loading: deleting } = useDeleteHoliday();

  const schema = React.useMemo(() => buildSchema(t), [t]);

  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const defaults: HolidayFormValues = React.useMemo(
    () => ({
      name: { en: '', hi: '', ...holiday.name },
      description: holiday.description ?? '',
      type: holiday.type,
      startDate: holiday.startDate,
      endDate: holiday.endDate,
      tagsText: holiday.tags.join(', '),
      isPublic: holiday.isPublic,
    }),
    [holiday],
  );

  const form = useAppForm({
    defaultValues: defaults,
    validators: { onChange: zodValidator(schema), onSubmit: zodValidator(schema) },
    onSubmit: async ({ value }) => {
      const parsed = schema.parse(value);
      try {
        await updateHoliday(holiday.id, {
          name: parsed.name,
          description: parsed.description.trim() || null,
          type: parsed.type as HolidayType,
          startDate: parsed.startDate,
          endDate: parsed.endDate,
          tags: parseTags(parsed.tagsText),
          isPublic: parsed.isPublic,
        });
        toast.success(t('actions.save'));
        router.push('/institute/holiday');
      } catch (err) {
        toast.error(extractGraphQLError(err, t('actions.save')));
      }
    },
  });

  async function handleDelete(): Promise<void> {
    try {
      await deleteHoliday(holiday.id);
      toast.success(t('actions.delete'));
      router.push('/institute/holiday');
    } catch (err) {
      toast.error(extractGraphQLError(err, t('actions.delete')));
    } finally {
      setConfirmOpen(false);
    }
  }

  const handleCancel = () => router.push('/institute/holiday');

  const typeOptions = HOLIDAY_TYPE_VALUES.map((v) => ({ value: v, label: t(`type.${v}`) }));

  return (
    <>
      <header className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight" data-testid={instituteHoliday.editTitle}>
          {t('editTitle')}
        </h1>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleCancel}
          data-testid={instituteHoliday.editBackBtn}
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
          <I18nField form={form} name="name" label={t('fields.name')} testId="holiday-edit-name" />

          <form.AppField name="description">
            {(field) => (
              <field.TextareaField
                label={t('fields.description')}
                maxLength={DESCRIPTION_MAX}
                rows={3}
                testId="holiday-edit-description"
              />
            )}
          </form.AppField>

          <form.AppField name="type">
            {(field) => (
              <field.SelectField
                label={t('fields.type')}
                options={typeOptions}
                placeholder={t('fields.type')}
                testId="holiday-edit-type-select"
              />
            )}
          </form.AppField>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <form.AppField name="startDate">
              {(field) => (
                <field.DateField label={t('fields.startDate')} testId="holiday-edit-start-date" />
              )}
            </form.AppField>
            <form.AppField name="endDate">
              {(field) => (
                <field.DateField label={t('fields.endDate')} testId="holiday-edit-end-date" />
              )}
            </form.AppField>
          </div>

          <form.AppField name="tagsText">
            {(field) => (
              <field.TextField
                label={t('fields.tags')}
                description={t('fields.tagsHint')}
                placeholder="gazetted, restricted"
                testId="holiday-edit-tags"
              />
            )}
          </form.AppField>

          <form.AppField name="isPublic">
            {(field) => (
              <field.SwitchField
                label={t('fields.isPublic')}
                description={t('fields.isPublicHint')}
                testId="holiday-edit-is-public"
              />
            )}
          </form.AppField>
        </FieldGroup>

        <div className="flex items-center justify-between gap-2">
          <Can I="delete" a="Holiday">
            <Button
              type="button"
              variant="outline"
              className="gap-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
              onClick={() => setConfirmOpen(true)}
              disabled={deleting}
              data-testid={instituteHoliday.editDeleteBtn}
            >
              <Trash2 className="size-4" aria-hidden="true" />
              {deleting ? t('actions.deleting') : t('actions.delete')}
            </Button>
          </Can>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              data-testid={instituteHoliday.editCancelBtn}
            >
              {t('detail.back')}
            </Button>
            <form.AppForm>
              <form.SubmitButton
                testId="holiday-edit-submit-btn"
                submittingLabel={t('actions.saving')}
              >
                {t('actions.save')}
              </form.SubmitButton>
            </form.AppForm>
          </div>
        </div>
      </form>

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!open) setConfirmOpen(false);
        }}
      >
        <AlertDialogContent data-testid={instituteHoliday.editDeleteDialog}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('actions.deleteConfirm.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('actions.deleteConfirm.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={deleting}
              data-testid={instituteHoliday.editDeleteCancelBtn}
            >
              {t('actions.deleteConfirm.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              data-testid={instituteHoliday.editDeleteConfirmBtn}
            >
              {deleting ? t('actions.deleting') : t('actions.deleteConfirm.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
