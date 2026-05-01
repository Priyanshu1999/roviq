'use client';

import { extractGraphQLError } from '@roviq/graphql';
import { useI18nField } from '@roviq/i18n';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldInfoPopover,
  FieldLabel,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@roviq/ui';
import { testIds } from '@roviq/ui/testing/testid-registry';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { toast } from 'sonner';
import {
  useAcademicYearsForAdmission,
  useConvertEnquiry,
  useStandardsForAdmission,
} from '../use-admission';

const { instituteAdmissionEnquiries } = testIds;
export interface ConvertEnquiryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enquiryId: string | null;
  enquiryLabel?: string;
}

/**
 * Prompts the user to pick standardId + academicYearId, then calls
 * `convertEnquiryToApplication`. Standards are loaded lazily once the user
 * picks an academic year — prevents fetching every year's standards up
 * front just to populate a dropdown.
 */
export function ConvertEnquiryDialog({
  open,
  onOpenChange,
  enquiryId,
  enquiryLabel,
}: ConvertEnquiryDialogProps) {
  const t = useTranslations('admission');
  const router = useRouter();
  const resolveI18n = useI18nField();

  const [academicYearId, setAcademicYearId] = React.useState('');
  const [standardId, setStandardId] = React.useState('');

  const { data: yearsData } = useAcademicYearsForAdmission();
  const academicYears = yearsData?.academicYears ?? [];

  const { data: standardsData, loading: standardsLoading } = useStandardsForAdmission(
    academicYearId || null,
  );
  const standards = standardsData?.standards ?? [];

  const [convert, { loading }] = useConvertEnquiry();

  // Default to the active year the first time the dialog opens — a small
  // quality-of-life touch so the user rarely has to change the year picker.
  React.useEffect(() => {
    if (open && !academicYearId) {
      const active = academicYears.find((y) => y.isActive);
      if (active) setAcademicYearId(active.id);
    }
    if (!open) {
      setAcademicYearId('');
      setStandardId('');
    }
  }, [open, academicYears, academicYearId]);

  const canSubmit = !!enquiryId && !!academicYearId && !!standardId && !loading;

  const handleSubmit = async () => {
    if (!canSubmit || !enquiryId) return;
    try {
      const result = await convert({
        variables: { enquiryId, standardId, academicYearId },
      });
      toast.success(t('enquiries.convertDialog.success'));
      onOpenChange(false);
      const appId = result.data?.convertEnquiryToApplication.id;
      if (appId) {
        router.push(`/institute/admission/applications?application=${appId}`);
      }
    } catch (err) {
      const message = extractGraphQLError(err, t('enquiries.convertDialog.error'));
      toast.error(t('enquiries.convertDialog.error'), { description: message });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid={instituteAdmissionEnquiries.convertDialog}>
        <DialogHeader>
          <DialogTitle>{t('enquiries.convertDialog.title')}</DialogTitle>
          <DialogDescription>
            {enquiryLabel
              ? `${t('enquiries.convertDialog.description')} (${enquiryLabel})`
              : t('enquiries.convertDialog.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Field>
            <FieldLabel htmlFor="convert-academic-year">
              {t('enquiries.convertDialog.academicYearLabel')}
              <FieldInfoPopover
                title={t('enquiries.convertDialog.fieldHelp.academicYearTitle')}
                data-testid={instituteAdmissionEnquiries.convertYearInfo}
              >
                <p>{t('enquiries.convertDialog.fieldHelp.academicYearBody')}</p>
                <p>
                  <em>{t('enquiries.convertDialog.fieldHelp.academicYearExample')}</em>
                </p>
              </FieldInfoPopover>
            </FieldLabel>
            <Select value={academicYearId} onValueChange={setAcademicYearId}>
              <SelectTrigger
                id="convert-academic-year"
                data-testid={instituteAdmissionEnquiries.convertYearSelect}
              >
                <SelectValue placeholder={t('enquiries.convertDialog.academicYearPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {academicYears.map((y) => (
                  <SelectItem key={y.id} value={y.id}>
                    {y.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel htmlFor="convert-standard">
              {t('enquiries.convertDialog.standardLabel')}
            </FieldLabel>
            <Select
              value={standardId}
              onValueChange={setStandardId}
              disabled={!academicYearId || standardsLoading}
            >
              <SelectTrigger
                id="convert-standard"
                data-testid={instituteAdmissionEnquiries.convertStandardSelect}
              >
                <SelectValue placeholder={t('enquiries.convertDialog.standardPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {standards.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {resolveI18n(s.name) ?? s.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            data-testid={instituteAdmissionEnquiries.convertCancelBtn}
          >
            {t('enquiries.convertDialog.cancel')}
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            data-testid={instituteAdmissionEnquiries.convertSubmitBtn}
          >
            {loading && <Loader2 aria-hidden="true" className="size-4 animate-spin" />}
            {loading
              ? t('enquiries.convertDialog.submitting')
              : t('enquiries.convertDialog.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
