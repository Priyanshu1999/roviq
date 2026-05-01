'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@roviq/ui';
import Image from 'next/image';
import { useTranslations } from 'next-intl';

export interface InstituteBranding {
  logoUrl?: string | null;
  faviconUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  themeIdentifier?: string | null;
  coverImageUrl?: string | null;
}

function ColourSwatch({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="size-10 rounded-md border"
        style={{ backgroundColor: value ?? 'transparent' }}
        role="img"
        aria-label={label}
      />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-mono text-sm">{value ?? '—'}</p>
      </div>
    </div>
  );
}

export function BrandingDisplay({ branding }: { branding: InstituteBranding | null | undefined }) {
  const t = useTranslations('adminInstitutes.branding');

  if (!branding) {
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
    <div className="space-y-4" data-testid={testIds.adminInstituteDetail.brandingDisplay}>
      <Card>
        <CardHeader>
          <CardTitle>{t('imagesTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">{t('logo')}</p>
            {branding.logoUrl ? (
              <Image
                src={branding.logoUrl}
                alt={t('logo')}
                width={160}
                height={80}
                className="h-20 w-auto rounded border bg-muted/30 object-contain p-2"
                unoptimized
              />
            ) : (
              <p className="text-sm text-muted-foreground">—</p>
            )}
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">{t('favicon')}</p>
            {branding.faviconUrl ? (
              <Image
                src={branding.faviconUrl}
                alt={t('favicon')}
                width={32}
                height={32}
                className="size-10 rounded border bg-muted/30 object-contain p-1"
                unoptimized
              />
            ) : (
              <p className="text-sm text-muted-foreground">—</p>
            )}
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">{t('cover')}</p>
            {branding.coverImageUrl ? (
              <Image
                src={branding.coverImageUrl}
                alt={t('cover')}
                width={240}
                height={120}
                className="h-20 w-auto rounded border object-cover"
                unoptimized
              />
            ) : (
              <p className="text-sm text-muted-foreground">—</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('coloursTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <ColourSwatch label={t('primary')} value={branding.primaryColor} />
          <ColourSwatch label={t('secondary')} value={branding.secondaryColor} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('themeTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="font-mono text-sm">{branding.themeIdentifier ?? '—'}</p>
        </CardContent>
      </Card>
    </div>
  );
}

import { testIds } from '@roviq/ui/testing/testid-registry';
