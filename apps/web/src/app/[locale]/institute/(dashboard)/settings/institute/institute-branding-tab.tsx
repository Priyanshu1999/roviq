'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { extractGraphQLError } from '@roviq/graphql';
import {
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
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from '@roviq/ui';
import { Loader2, Upload, X } from 'lucide-react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { FormProvider, type Resolver, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { BrandingPreview } from './components/branding-preview';
import { type InstituteBrandingFormValues, instituteBrandingSchema } from './schemas';
import type { MyInstituteData } from './types';
import { useUpdateInstituteBranding } from './use-institute-settings';

const THEME_OPTIONS = ['default', 'classic', 'modern', 'minimal'] as const;

interface InstituteBrandingTabProps {
  institute: MyInstituteData['myInstitute'] | undefined;
  loading: boolean;
}

export function InstituteBrandingTab({ institute, loading }: InstituteBrandingTabProps) {
  const t = useTranslations('instituteSettings');
  const tb = useTranslations('instituteSettings.branding');
  const [updateBranding] = useUpdateInstituteBranding();

  const branding = institute?.branding;

  const form = useForm<InstituteBrandingFormValues>({
    resolver: zodResolver(instituteBrandingSchema) as Resolver<InstituteBrandingFormValues>,
    defaultValues: {
      logoUrl: '',
      faviconUrl: '',
      primaryColor: '#1e40af',
      secondaryColor: '#e2e8f0',
      themeIdentifier: 'default',
      coverImageUrl: '',
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
    if (!branding) return;
    reset({
      logoUrl: branding.logoUrl ?? '',
      faviconUrl: branding.faviconUrl ?? '',
      primaryColor: branding.primaryColor ?? '#1e40af',
      secondaryColor: branding.secondaryColor ?? '#e2e8f0',
      themeIdentifier: branding.themeIdentifier ?? 'default',
      coverImageUrl: branding.coverImageUrl ?? '',
    });
  }, [branding, reset]);

  const onSubmit = async (values: InstituteBrandingFormValues) => {
    try {
      await updateBranding({
        variables: {
          input: {
            logoUrl: values.logoUrl || undefined,
            faviconUrl: values.faviconUrl || undefined,
            primaryColor: values.primaryColor || undefined,
            secondaryColor: values.secondaryColor || undefined,
            themeIdentifier: values.themeIdentifier || undefined,
            coverImageUrl: values.coverImageUrl || undefined,
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

  /** Handle file selection — reads as data URL for preview, actual upload would go to MinIO. */
  function handleFileSelect(fieldName: 'logoUrl' | 'faviconUrl' | 'coverImageUrl') {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      // TODO: Upload to MinIO/S3 and get URL. For now, use object URL for preview.
      const url = URL.createObjectURL(file);
      setValue(fieldName, url, { shouldDirty: true });
    };
    input.click();
  }

  const currentTheme = watch('themeIdentifier');

  if (loading && !institute) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <Can I="update_branding" a="Institute" passThrough>
      {(allowed: boolean) => (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* Branding form */}
          <Card>
            <CardHeader>
              <CardTitle>{tb('title')}</CardTitle>
              <CardDescription>{tb('description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <FormProvider {...form}>
                <form onSubmit={handleSubmit(onSubmit)}>
                  <fieldset disabled={!allowed || isSubmitting}>
                    <FieldGroup>
                      {/* Logo upload */}
                      <Field>
                        <FieldLabel>{tb('logo')}</FieldLabel>
                        <FieldDescription>{tb('logoDescription')}</FieldDescription>
                        <div className="flex items-center gap-3">
                          {watch('logoUrl') ? (
                            <div className="relative">
                              <Image
                                src={watch('logoUrl') ?? ''}
                                alt="Logo"
                                width={64}
                                height={64}
                                className="rounded-lg border object-contain"
                                unoptimized
                              />
                              <button
                                type="button"
                                className="absolute -right-1 -top-1 rounded-full bg-destructive p-0.5 text-destructive-foreground"
                                onClick={() => setValue('logoUrl', '', { shouldDirty: true })}
                              >
                                <X className="size-3" />
                              </button>
                            </div>
                          ) : null}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleFileSelect('logoUrl')}
                          >
                            <Upload className="size-4" />
                            {watch('logoUrl') ? tb('changeFile') : tb('uploadLogo')}
                          </Button>
                        </div>
                      </Field>

                      {/* Favicon upload */}
                      <Field>
                        <FieldLabel>{tb('favicon')}</FieldLabel>
                        <FieldDescription>{tb('faviconDescription')}</FieldDescription>
                        <div className="flex items-center gap-3">
                          {watch('faviconUrl') ? (
                            <div className="relative">
                              <Image
                                src={watch('faviconUrl') ?? ''}
                                alt="Favicon"
                                width={32}
                                height={32}
                                className="rounded border object-contain"
                                unoptimized
                              />
                              <button
                                type="button"
                                className="absolute -right-1 -top-1 rounded-full bg-destructive p-0.5 text-destructive-foreground"
                                onClick={() => setValue('faviconUrl', '', { shouldDirty: true })}
                              >
                                <X className="size-3" />
                              </button>
                            </div>
                          ) : null}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleFileSelect('faviconUrl')}
                          >
                            <Upload className="size-4" />
                            {watch('faviconUrl') ? tb('changeFile') : tb('uploadFavicon')}
                          </Button>
                        </div>
                      </Field>

                      {/* Colors */}
                      <div className="grid grid-cols-2 gap-4">
                        <Field data-invalid={!!errors.primaryColor}>
                          <FieldLabel>{tb('primaryColor')}</FieldLabel>
                          <FieldDescription>{tb('primaryColorDescription')}</FieldDescription>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={watch('primaryColor') || '#1e40af'}
                              onChange={(e) =>
                                setValue('primaryColor', e.target.value, {
                                  shouldDirty: true,
                                })
                              }
                              className="h-8 w-10 cursor-pointer rounded border-0"
                            />
                            <Input
                              {...register('primaryColor')}
                              placeholder="#1e40af"
                              className="flex-1 font-mono text-sm"
                              aria-invalid={!!errors.primaryColor}
                            />
                          </div>
                          {errors.primaryColor && <FieldError errors={[errors.primaryColor]} />}
                        </Field>

                        <Field data-invalid={!!errors.secondaryColor}>
                          <FieldLabel>{tb('secondaryColor')}</FieldLabel>
                          <FieldDescription>{tb('secondaryColorDescription')}</FieldDescription>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={watch('secondaryColor') || '#e2e8f0'}
                              onChange={(e) =>
                                setValue('secondaryColor', e.target.value, {
                                  shouldDirty: true,
                                })
                              }
                              className="h-8 w-10 cursor-pointer rounded border-0"
                            />
                            <Input
                              {...register('secondaryColor')}
                              placeholder="#e2e8f0"
                              className="flex-1 font-mono text-sm"
                              aria-invalid={!!errors.secondaryColor}
                            />
                          </div>
                          {errors.secondaryColor && <FieldError errors={[errors.secondaryColor]} />}
                        </Field>
                      </div>

                      {/* Theme select */}
                      <Field>
                        <FieldLabel>{tb('theme')}</FieldLabel>
                        <FieldDescription>{tb('themeDescription')}</FieldDescription>
                        <Select
                          value={currentTheme}
                          onValueChange={(v) =>
                            setValue('themeIdentifier', v, { shouldDirty: true })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {THEME_OPTIONS.map((theme) => (
                              <SelectItem key={theme} value={theme}>
                                {tb(`themeOptions.${theme}`)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>

                      {/* Cover image upload */}
                      <Field>
                        <FieldLabel>{tb('coverImage')}</FieldLabel>
                        <FieldDescription>{tb('coverImageDescription')}</FieldDescription>
                        <div className="space-y-2">
                          {watch('coverImageUrl') ? (
                            <div className="relative">
                              <Image
                                src={watch('coverImageUrl') ?? ''}
                                alt="Cover"
                                width={1920}
                                height={480}
                                className="h-32 w-full rounded-lg border object-cover"
                                unoptimized
                              />
                              <button
                                type="button"
                                className="absolute right-2 top-2 rounded-full bg-destructive p-1 text-destructive-foreground"
                                onClick={() => setValue('coverImageUrl', '', { shouldDirty: true })}
                              >
                                <X className="size-4" />
                              </button>
                            </div>
                          ) : null}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleFileSelect('coverImageUrl')}
                          >
                            <Upload className="size-4" />
                            {watch('coverImageUrl') ? tb('changeFile') : tb('uploadCoverImage')}
                          </Button>
                        </div>
                      </Field>
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

          {/* Live preview sidebar */}
          <div className="hidden lg:block">
            <FormProvider {...form}>
              <BrandingPreview />
            </FormProvider>
          </div>

          {!allowed && <p className="text-sm text-muted-foreground">{t('noPermission')}</p>}
        </div>
      )}
    </Can>
  );
}
