'use client';

import { extractGraphQLError } from '@roviq/graphql';
import {
  Button,
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
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@roviq/ui';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { AddressForm } from '../../../../institute/(dashboard)/settings/institute/components/address-form';
import { ContactBuilder } from '../../../../institute/(dashboard)/settings/institute/components/contact-builder';
import { useCreateInstituteGroup } from '../use-institute-groups';

/** Available group types matching the backend GroupTypeEnum. */
const GROUP_TYPES = ['TRUST', 'SOCIETY', 'CHAIN', 'FRANCHISE'] as const;

interface CreateGroupForm {
  name: string;
  code: string;
  type: string;
  registrationNumber: string;
  registrationState: string;
  contact: {
    phones: Array<{
      country_code: string;
      number: string;
      is_primary: boolean;
      is_whatsapp_enabled: boolean;
      label: string;
    }>;
    emails: Array<{
      address: string;
      is_primary: boolean;
      label: string;
    }>;
  };
  address: {
    line1: string;
    line2?: string;
    line3?: string;
    city: string;
    district: string;
    state: string;
    postal_code: string;
    country: string;
    coordinates?: { lat: number; lng: number };
  };
}

export default function NewInstituteGroupPage() {
  const t = useTranslations('instituteGroups');
  const router = useRouter();
  const [createGroup, { loading }] = useCreateInstituteGroup();

  const form = useForm<CreateGroupForm>({
    defaultValues: {
      name: '',
      code: '',
      type: 'TRUST',
      registrationNumber: '',
      registrationState: '',
      contact: { phones: [], emails: [] },
      address: {
        line1: '',
        line2: '',
        line3: '',
        city: '',
        district: '',
        state: '',
        postal_code: '',
        country: 'IN',
      },
    },
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = form;

  const onSubmit = async (data: CreateGroupForm) => {
    try {
      await createGroup({
        variables: {
          input: {
            name: data.name,
            code: data.code,
            type: data.type,
            registrationNumber: data.registrationNumber || undefined,
            registrationState: data.registrationState || undefined,
            contact:
              data.contact.phones.length > 0 || data.contact.emails.length > 0
                ? data.contact
                : undefined,
            address: data.address.line1 ? data.address : undefined,
          },
        },
      });
      toast.success(t('created'));
      router.push('/admin/institute-groups');
    } catch (err) {
      toast.error(extractGraphQLError(err));
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/admin/institute-groups"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {t('back')}
        </Link>
      </div>

      <FormProvider {...form}>
        <Card>
          <CardHeader>
            <CardTitle>{t('createGroup')}</CardTitle>
            <CardDescription>{t('description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <FieldGroup>
                <Field>
                  <FieldLabel>{t('name')}</FieldLabel>
                  <Input {...register('name', { required: true })} />
                  {errors.name && <FieldError>{errors.name.message}</FieldError>}
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel>{t('code')}</FieldLabel>
                    <Input
                      placeholder={t('codePlaceholder')}
                      {...register('code', { required: true })}
                    />
                    <FieldDescription>{t('codePlaceholder')}</FieldDescription>
                    {errors.code && <FieldError>{errors.code.message}</FieldError>}
                  </Field>

                  <Field>
                    <FieldLabel>{t('type')}</FieldLabel>
                    <Select value={watch('type')} onValueChange={(v) => setValue('type', v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {GROUP_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {t(`types.${type}` as Parameters<typeof t>[0])}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel>{t('registrationNumber')}</FieldLabel>
                    <Input {...register('registrationNumber')} />
                  </Field>
                  <Field>
                    <FieldLabel>{t('registrationState')}</FieldLabel>
                    <Input {...register('registrationState')} />
                  </Field>
                </div>
              </FieldGroup>

              {/* Contact information */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium">{t('contact')}</h3>
                <ContactBuilder />
              </div>

              {/* Address information */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium">{t('address')}</h3>
                <AddressForm />
              </div>

              <div className="flex justify-end gap-3">
                <Link href="/admin/institute-groups">
                  <Button type="button" variant="outline">
                    {t('cancel')}
                  </Button>
                </Link>
                <Button type="submit" disabled={loading}>
                  {loading && <Loader2 className="me-2 size-4 animate-spin" />}
                  {loading ? t('creating') : t('createGroup')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </FormProvider>
    </div>
  );
}
