'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@roviq/ui';
import { useTranslations } from 'next-intl';
import { parseAsString, useQueryState } from 'nuqs';
import * as React from 'react';
import { toast } from 'sonner';
import { InstituteBrandingTab } from './institute-branding-tab';
import { InstituteConfigTab } from './institute-config-tab';
import { InstituteInfoTab } from './institute-info-tab';
import {
  useInstituteBrandingSubscription,
  useInstituteConfigSubscription,
  useMyInstitute,
} from './use-institute-settings';

export default function InstituteSettingsPage() {
  const t = useTranslations('instituteSettings');
  const tb = useTranslations('instituteSettings.branding');
  const tc = useTranslations('instituteSettings.config');

  const [activeTab, setActiveTab] = useQueryState('tab', parseAsString.withDefault('info'));

  const { data, loading, refetch } = useMyInstitute();
  const institute = data?.myInstitute;

  // Track form dirty state for beforeunload guard
  const [isDirty, setIsDirty] = React.useState(false);

  React.useEffect(() => {
    if (!isDirty) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Listen to form dirty state from child tab forms via DOM events
  React.useEffect(() => {
    function handleDirtyChange(e: Event) {
      const detail = (e as CustomEvent<{ dirty: boolean }>).detail;
      setIsDirty(detail.dirty);
    }

    window.addEventListener('institute-form-dirty', handleDirtyChange);
    return () => window.removeEventListener('institute-form-dirty', handleDirtyChange);
  }, []);

  // ─── Subscriptions ─────────────────────────────────────────────────────────

  const { data: brandingSub } = useInstituteBrandingSubscription();
  const { data: configSub } = useInstituteConfigSubscription();

  React.useEffect(() => {
    if (brandingSub?.instituteBrandingUpdated) {
      toast.info(tb('updatedByOther', { name: 'Another admin' }));
      refetch();
    }
  }, [brandingSub, tb, refetch]);

  React.useEffect(() => {
    if (configSub?.instituteConfigUpdated) {
      toast.info(tc('updatedByOther', { name: 'Another admin' }));
      refetch();
    }
  }, [configSub, tc, refetch]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('description')}</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="info">{t('tabs.info')}</TabsTrigger>
          <TabsTrigger value="branding">{t('tabs.branding')}</TabsTrigger>
          <TabsTrigger value="configuration">{t('tabs.configuration')}</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="mt-6">
          <InstituteInfoTab institute={institute} loading={loading} refetch={refetch} />
        </TabsContent>

        <TabsContent value="branding" className="mt-6">
          <InstituteBrandingTab institute={institute} loading={loading} />
        </TabsContent>

        <TabsContent value="configuration" className="mt-6">
          <InstituteConfigTab institute={institute} loading={loading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
