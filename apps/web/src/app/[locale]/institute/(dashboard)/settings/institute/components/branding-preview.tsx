'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useFormContext } from 'react-hook-form';
import type { InstituteBrandingFormValues } from '../schemas';

export function BrandingPreview() {
  const t = useTranslations('instituteSettings.branding');
  const { watch } = useFormContext<InstituteBrandingFormValues>();

  const logoUrl = watch('logoUrl');
  const primaryColor = watch('primaryColor') || '#1e40af';
  const secondaryColor = watch('secondaryColor') || '#e2e8f0';

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="p-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">{t('preview')}</p>
      </div>

      {/* Mini header preview */}
      <div className="flex items-center gap-3 px-4 py-3" style={{ backgroundColor: primaryColor }}>
        {logoUrl ? (
          <Image
            src={logoUrl}
            alt="Logo preview"
            width={32}
            height={32}
            className="rounded object-contain"
            unoptimized
          />
        ) : (
          <div
            className="flex size-8 items-center justify-center rounded text-xs font-bold text-white"
            style={{ backgroundColor: secondaryColor }}
          >
            IN
          </div>
        )}
        <span className="text-sm font-semibold text-white">Institute Name</span>
      </div>

      {/* Mini sidebar preview */}
      <div className="flex">
        <div className="w-48 space-y-1 p-3" style={{ backgroundColor: secondaryColor }}>
          {['Dashboard', 'Students', 'Teachers', 'Settings'].map((item) => (
            <div
              key={item}
              className="rounded px-3 py-1.5 text-xs"
              style={{
                backgroundColor: item === 'Settings' ? primaryColor : 'transparent',
                color: item === 'Settings' ? '#ffffff' : '#374151',
              }}
            >
              {item}
            </div>
          ))}
        </div>
        <div className="flex-1 bg-background p-4">
          <div className="h-2 w-24 rounded bg-muted" />
          <div className="mt-2 h-2 w-32 rounded bg-muted" />
          <div className="mt-2 h-2 w-20 rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}
