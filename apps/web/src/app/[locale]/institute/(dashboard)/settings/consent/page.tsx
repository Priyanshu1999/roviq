'use client';

/**
 * DPDP Act 2023 consent dashboard for guardians (ROV-169).
 *
 * Renders one card per linked child, with a toggle for each of the 11 DPDP
 * data-processing purposes. Granting and withdrawing consent are mutations
 * that create append-only `consent_records` rows on the backend; this page
 * never edits an existing record.
 *
 * Non-guardian roles see an access-denied panel — `myProfile` returns the
 * union variant `MyGuardianProfile` only when the logged-in user has a
 * guardian membership, so the type discriminator is the source of truth.
 */

import { extractGraphQLError, gql, useMutation, useQuery } from '@roviq/graphql';
import { useFormatDate, useI18nField } from '@roviq/i18n';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Skeleton,
  Switch,
} from '@roviq/ui';
import { parseISO } from 'date-fns';
import { AlertTriangle, RefreshCw, ShieldCheck, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { toast } from 'sonner';

const { instituteConsent } = testIds;
// ── Constants ─────────────────────────────────────────────────────────────

/**
 * The 11 DPDP Act 2023 purposes for which consent must be collected from
 * a guardian. Source of truth is the `GrantConsentInput.purpose` description
 * in `libs/frontend/graphql/src/generated/schema.graphql`.
 */
const DPDP_PURPOSES = [
  'academic_data_processing',
  'photo_video_marketing',
  'whatsapp_communication',
  'sms_communication',
  'aadhaar_collection',
  'biometric_collection',
  'third_party_edtech',
  'board_exam_registration',
  'transport_tracking',
  'health_data_processing',
  'cctv_monitoring',
] as const;

type DpdpPurpose = (typeof DPDP_PURPOSES)[number];

/**
 * Visual grouping for the dashboard. The DPDP Act doesn't define these
 * categories — they exist purely to make the toggle list scannable.
 */
const PURPOSE_CATEGORIES: Record<string, DpdpPurpose[]> = {
  academic: ['academic_data_processing'],
  communication: ['whatsapp_communication', 'sms_communication'],
  identity: ['aadhaar_collection', 'biometric_collection'],
  health: ['health_data_processing'],
  compliance: ['board_exam_registration', 'cctv_monitoring'],
  external: ['third_party_edtech', 'transport_tracking'],
  marketing: ['photo_video_marketing'],
};

// ── GraphQL ───────────────────────────────────────────────────────────────

const MY_PROFILE_QUERY = gql`
  query ConsentMyProfile {
    myProfile {
      ... on MyGuardianProfile {
        type
        children {
          studentProfileId
          firstName
          lastName
          relationship
          isPrimaryContact
        }
      }
      ... on MyStudentProfile {
        type
      }
      ... on MyStaffProfile {
        type
      }
    }
  }
`;

const MY_CONSENT_STATUS_QUERY = gql`
  query MyConsentStatus {
    myConsentStatus {
      studentProfileId
      purpose
      isGranted
      lastUpdatedAt
    }
  }
`;

const GRANT_CONSENT = gql`
  mutation GrantConsent($input: GrantConsentInput!) {
    grantConsent(input: $input) {
      id
    }
  }
`;

const WITHDRAW_CONSENT = gql`
  mutation WithdrawConsent($input: WithdrawConsentInput!) {
    withdrawConsent(input: $input) {
      id
    }
  }
`;

interface LinkedChild {
  studentProfileId: string;
  firstName: Record<string, string> | string | null;
  lastName: Record<string, string> | string | null;
  relationship: string;
  isPrimaryContact: boolean;
}

interface MyProfileResult {
  myProfile: {
    type: 'guardian' | 'student' | 'staff';
    children?: LinkedChild[];
  };
}

interface ConsentStatus {
  studentProfileId: string;
  purpose: string;
  isGranted: boolean;
  lastUpdatedAt: string | null;
}

interface MyConsentStatusResult {
  myConsentStatus: ConsentStatus[];
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function ConsentDashboardPage() {
  const t = useTranslations('consent');
  const profileQuery = useQuery<MyProfileResult>(MY_PROFILE_QUERY);

  const profile = profileQuery.data?.myProfile;
  const isGuardian = profile?.type === 'guardian';
  const children = profile?.children ?? [];

  // Only fetch consent status once we know the user is a guardian —
  // non-guardian roles don't have `read Consent` ability.
  const consentQuery = useQuery<MyConsentStatusResult>(MY_CONSENT_STATUS_QUERY, {
    skip: !isGuardian,
  });
  const consentStatus = consentQuery.data?.myConsentStatus ?? [];

  if (profileQuery.loading || (isGuardian && consentQuery.loading)) {
    return <ConsentDashboardSkeleton />;
  }

  if (profileQuery.error || (isGuardian && consentQuery.error)) {
    return (
      <Card className="border-rose-300 bg-rose-50 dark:border-rose-700 dark:bg-rose-950">
        <CardContent className="flex items-start gap-3 pt-6">
          <AlertTriangle
            className="mt-0.5 size-5 text-rose-600 dark:text-rose-400"
            aria-hidden="true"
          />
          <div className="flex-1 space-y-2">
            <p className="font-medium text-rose-900 dark:text-rose-100">{t('errors.loadFailed')}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void profileQuery.refetch();
                void consentQuery.refetch();
              }}
            >
              <RefreshCw className="me-2 size-4" aria-hidden="true" />
              {t('retry')}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!isGuardian) {
    return (
      <Empty className="py-16" data-testid={instituteConsent.notGuardian}>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ShieldCheck />
          </EmptyMedia>
          <EmptyTitle>{t('notAGuardian.title')}</EmptyTitle>
          <EmptyDescription>{t('notAGuardian.description')}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  if (children.length === 0) {
    return (
      <Empty className="py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Users />
          </EmptyMedia>
          <EmptyTitle>{t('empty.title')}</EmptyTitle>
          <EmptyDescription>{t('empty.description')}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-full bg-muted">
          <ShieldCheck className="size-5" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid={instituteConsent.title}>
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('description')}</p>
        </div>
      </header>

      {/* Privacy notice — DPDP Act 2023 transparency requirement */}
      <Card
        className="border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-950"
        data-testid={instituteConsent.privacyNotice}
      >
        <CardHeader>
          <CardTitle className="text-base text-blue-900 dark:text-blue-100">
            {t('privacyNotice.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-blue-800 dark:text-blue-200">{t('privacyNotice.body')}</p>
          <p className="mt-2 text-xs text-blue-700 dark:text-blue-300">{t('appendOnlyNotice')}</p>
        </CardContent>
      </Card>

      {/* One card per linked child */}
      {children.map((child) => (
        <ChildConsentCard
          key={child.studentProfileId}
          child={child}
          consentStatus={consentStatus}
          onChange={() => {
            void consentQuery.refetch();
          }}
          data-testid={`consent-child-${child.studentProfileId}`}
        />
      ))}
    </div>
  );
}

// ── Child consent card ───────────────────────────────────────────────────

function ChildConsentCard({
  child,
  consentStatus,
  onChange,
  'data-testid': dataTestId,
}: {
  child: LinkedChild;
  consentStatus: ConsentStatus[];
  onChange: () => void;
  'data-testid'?: string;
}) {
  const t = useTranslations('consent');
  const resolveI18n = useI18nField();

  const fullName = [resolveI18n(child.firstName), resolveI18n(child.lastName)]
    .filter(Boolean)
    .join(' ');

  // Map purpose → status for THIS child only
  const purposeStatus = React.useMemo(() => {
    const map = new Map<string, ConsentStatus>();
    for (const s of consentStatus) {
      if (s.studentProfileId === child.studentProfileId) {
        map.set(s.purpose, s);
      }
    }
    return map;
  }, [consentStatus, child.studentProfileId]);

  const grantedCount = React.useMemo(() => {
    let n = 0;
    for (const purpose of DPDP_PURPOSES) {
      if (purposeStatus.get(purpose)?.isGranted) n += 1;
    }
    return n;
  }, [purposeStatus]);

  return (
    <Card data-testid={dataTestId}>
      <CardHeader>
        <CardTitle>{fullName || t('child')}</CardTitle>
        <CardDescription>
          {t('childSummary', { granted: grantedCount, total: DPDP_PURPOSES.length })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {Object.entries(PURPOSE_CATEGORIES).map(([category, purposes]) => (
          <section key={category} className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t(`categories.${category}`)}
            </h3>
            <div className="space-y-3">
              {purposes.map((purpose) => (
                <PurposeRow
                  key={purpose}
                  studentProfileId={child.studentProfileId}
                  childName={fullName}
                  purpose={purpose}
                  status={purposeStatus.get(purpose) ?? null}
                  onChange={onChange}
                />
              ))}
            </div>
          </section>
        ))}
      </CardContent>
    </Card>
  );
}

// ── Single purpose row ────────────────────────────────────────────────────

function PurposeRow({
  studentProfileId,
  childName,
  purpose,
  status,
  onChange,
}: {
  studentProfileId: string;
  childName: string;
  purpose: DpdpPurpose;
  status: ConsentStatus | null;
  onChange: () => void;
}) {
  const t = useTranslations('consent');
  const { format } = useFormatDate();
  const [grantConsent, grantState] = useMutation(GRANT_CONSENT);
  const [withdrawConsent, withdrawState] = useMutation(WITHDRAW_CONSENT);
  const [withdrawOpen, setWithdrawOpen] = React.useState(false);

  const isGranted = status?.isGranted ?? false;
  const isPending = grantState.loading || withdrawState.loading;

  const handleToggle = async (next: boolean) => {
    if (next) {
      // Granting consent — fire immediately, no confirmation
      try {
        await grantConsent({
          variables: {
            input: { studentProfileId, purpose },
          },
        });
        toast.success(t('grantedToast'));
        onChange();
      } catch (err) {
        toast.error(extractGraphQLError(err, t('errors.grantFailed')));
      }
    } else {
      // Withdrawing — open confirmation dialog because it's append-only
      setWithdrawOpen(true);
    }
  };

  const handleConfirmWithdraw = async () => {
    try {
      await withdrawConsent({
        variables: {
          input: { studentProfileId, purpose },
        },
      });
      toast.success(t('withdrawnToast'));
      setWithdrawOpen(false);
      onChange();
    } catch (err) {
      toast.error(extractGraphQLError(err, t('errors.withdrawFailed')));
    }
  };

  return (
    <>
      <div
        className={`flex items-start justify-between gap-4 rounded-md border p-4 ${
          isGranted
            ? 'border-emerald-300 bg-emerald-50/40 dark:border-emerald-700 dark:bg-emerald-950/40'
            : 'border-border bg-background'
        }`}
      >
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <p className="font-medium">{t(`purposes.${purpose}.label`)}</p>
            <Badge
              variant="outline"
              className={
                isGranted
                  ? 'border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300'
                  : 'border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400'
              }
            >
              {isGranted ? t('granted') : t('withdrawn')}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{t(`purposes.${purpose}.description`)}</p>
          {status?.lastUpdatedAt && (
            <p className="text-xs text-muted-foreground">
              {t('lastUpdated')}: {format(parseISO(status.lastUpdatedAt), 'dd/MM/yyyy')}
            </p>
          )}
        </div>
        <Switch
          checked={isGranted}
          disabled={isPending}
          onCheckedChange={(next) => {
            void handleToggle(next === true);
          }}
          aria-label={isGranted ? t('withdraw') : t('grant')}
          data-testid={`consent-toggle-${purpose}`}
        />
      </div>

      <AlertDialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <AlertDialogContent data-testid={instituteConsent.withdrawDialog}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('withdrawDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('withdrawDialog.description', {
                purpose: t(`purposes.${purpose}.label`),
                child: childName,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('withdrawDialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              data-testid={instituteConsent.withdrawConfirm}
              onClick={() => {
                void handleConfirmWithdraw();
              }}
            >
              {t('withdrawDialog.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────

function ConsentDashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <header className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-96" />
      </header>
      <Skeleton className="h-32 w-full" />
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-64" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

import { testIds } from '@roviq/ui/testing/testid-registry';
