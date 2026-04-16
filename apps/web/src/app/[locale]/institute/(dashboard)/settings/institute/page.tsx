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

  // ─── Unsaved-changes guard ──────────────────────────────────────────────────

  const [isDirty, setIsDirty] = React.useState(false);

  // Listen to dirty state emitted by child tab forms
  React.useEffect(() => {
    function handleDirtyChange(e: Event) {
      const detail = (e as CustomEvent<{ dirty: boolean }>).detail;
      setIsDirty(detail.dirty);
    }
    window.addEventListener('institute-form-dirty', handleDirtyChange);
    return () => window.removeEventListener('institute-form-dirty', handleDirtyChange);
  }, []);

  // Browser navigation guard (refresh / close tab)
  React.useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // In-app navigation guard — intercept history.pushState / replaceState so
  // Next.js Link clicks also prompt before discarding unsaved changes.
  React.useEffect(() => {
    if (!isDirty) return;

    const confirmMsg = t('unsavedChanges');

    const originalPush = window.history.pushState.bind(window.history);
    const originalReplace = window.history.replaceState.bind(window.history);

    const guardedPush: typeof history.pushState = (state, unused, url) => {
      if (window.confirm(confirmMsg)) {
        originalPush(state, unused, url);
      }
    };
    const guardedReplace: typeof history.replaceState = (state, unused, url) => {
      if (window.confirm(confirmMsg)) {
        originalReplace(state, unused, url);
      }
    };

    window.history.pushState = guardedPush;
    window.history.replaceState = guardedReplace;

    return () => {
      window.history.pushState = originalPush;
      window.history.replaceState = originalReplace;
    };
  }, [isDirty, t]);

  // ─── Subscriptions ──────────────────────────────────────────────────────────

  const { data: brandingSub } = useInstituteBrandingSubscription();
  const { data: configSub } = useInstituteConfigSubscription();

  React.useEffect(() => {
    if (brandingSub?.instituteBrandingUpdated) {
      toast.info(tb('updatedByOther'));
      refetch();
    }
  }, [brandingSub, tb, refetch]);

  React.useEffect(() => {
    if (configSub?.instituteConfigUpdated) {
      toast.info(tc('updatedByOther'));
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
