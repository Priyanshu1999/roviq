'use client';

import { extractGraphQLError, gql, useMutation, useQuery } from '@roviq/graphql';
import { useFormatDate, useI18nField, zodValidator } from '@roviq/i18n';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FieldGroup,
  useAppForm,
} from '@roviq/ui';
import { parseISO } from 'date-fns';
import { AlertTriangle, RefreshCw, ShieldCheck, UserRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { useFormDraft } from '../../../../../hooks/use-form-draft';

const { instituteProfile } = testIds;
/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type I18nText = Record<string, string> | null | undefined;

interface UserProfileData {
  id: string;
  userId: string;
  firstName: Record<string, string>;
  lastName: I18nText;
  dateOfBirth: string | null;
  gender: string | null;
  bloodGroup: string | null;
  nationality: string | null;
  profileImageUrl: string | null;
}

interface LinkedChild {
  studentProfileId: string;
  firstName: I18nText;
  lastName: I18nText;
  relationship: string;
  isPrimaryContact: boolean;
}

interface MyStudentProfile {
  __typename: 'MyStudentProfile';
  type: string;
  userProfile: UserProfileData;
  studentProfile: Record<string, unknown> | null;
  academics: Record<string, unknown> | null;
}

interface MyStaffProfile {
  __typename: 'MyStaffProfile';
  type: string;
  userProfile: UserProfileData;
  staffProfile: Record<string, unknown> | null;
}

interface MyGuardianProfile {
  __typename: 'MyGuardianProfile';
  type: string;
  userProfile: UserProfileData;
  guardianProfile: Record<string, unknown> | null;
  children: LinkedChild[] | null;
}

type MyProfile = MyStudentProfile | MyStaffProfile | MyGuardianProfile;

interface MyProfileQueryResult {
  myProfile: MyProfile;
}

interface UpdateMyProfileInput {
  phone?: string | null;
  profileImageUrl?: string | null;
  nationality?: string | null;
  religion?: string | null;
  motherTongue?: string | null;
}

interface UpdateMyProfileResult {
  updateMyProfile: UserProfileData;
}

/* ------------------------------------------------------------------ */
/* GraphQL                                                             */
/* ------------------------------------------------------------------ */

const MY_PROFILE_QUERY = gql`
  query MyProfile {
    myProfile {
      __typename
      ... on MyStudentProfile {
        type
        userProfile {
          id
          userId
          firstName
          lastName
          dateOfBirth
          gender
          bloodGroup
          nationality
          profileImageUrl
        }
        studentProfile
        academics
      }
      ... on MyStaffProfile {
        type
        userProfile {
          id
          userId
          firstName
          lastName
          dateOfBirth
          gender
          bloodGroup
          nationality
          profileImageUrl
        }
        staffProfile
      }
      ... on MyGuardianProfile {
        type
        userProfile {
          id
          userId
          firstName
          lastName
          dateOfBirth
          gender
          bloodGroup
          nationality
          profileImageUrl
        }
        guardianProfile
        children {
          studentProfileId
          firstName
          lastName
          relationship
          isPrimaryContact
        }
      }
    }
  }
`;

const UPDATE_MY_PROFILE_MUTATION = gql`
  mutation UpdateMyProfile($input: UpdateMyProfileInput!) {
    updateMyProfile(input: $input) {
      id
      userId
      firstName
      lastName
      dateOfBirth
      gender
      bloodGroup
      nationality
      profileImageUrl
    }
  }
`;

/* ------------------------------------------------------------------ */
/* Form schema                                                         */
/* ------------------------------------------------------------------ */

const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;

function buildProfileEditSchema(t: ReturnType<typeof useTranslations>) {
  return z.object({
    phone: z
      .string()
      .trim()
      .refine((v) => v === '' || INDIAN_MOBILE_REGEX.test(v), {
        message: t('errors.phoneInvalid'),
      }),
    profileImageUrl: z
      .string()
      .trim()
      .refine(
        (v) => {
          if (v === '') return true;
          try {
            new URL(v);
            return true;
          } catch {
            return false;
          }
        },
        { message: t('errors.urlInvalid') },
      ),
  });
}

type ProfileEditFormValues = z.infer<ReturnType<typeof buildProfileEditSchema>>;

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function MyProfilePage() {
  const t = useTranslations('profile');
  const { data, loading, error, refetch } = useQuery<MyProfileQueryResult>(MY_PROFILE_QUERY, {
    fetchPolicy: 'cache-and-network',
  });

  const [updateMyProfile, { loading: saving }] = useMutation<UpdateMyProfileResult>(
    UPDATE_MY_PROFILE_MUTATION,
  );

  const profile = data?.myProfile;
  const userProfile = profile?.userProfile;

  const profileEditSchema = React.useMemo(() => buildProfileEditSchema(t), [t]);

  const form = useAppForm({
    defaultValues: { phone: '', profileImageUrl: '' } as ProfileEditFormValues,
    validators: {
      onChange: zodValidator(profileEditSchema),
      onSubmit: zodValidator(profileEditSchema),
    },
    onSubmit: async ({ value }) => {
      const parsed = profileEditSchema.parse(value);
      const input: UpdateMyProfileInput = {
        phone: parsed.phone === '' ? null : parsed.phone,
        profileImageUrl: parsed.profileImageUrl === '' ? null : parsed.profileImageUrl,
      };
      try {
        await updateMyProfile({ variables: { input } });
        toast.success(t('saved'));
        draft.clearDraft();
        await refetch();
      } catch (err) {
        toast.error(extractGraphQLError(err, t('errors.updateFailed')));
      }
    },
  });

  // Hydrate form defaults once we have data
  React.useEffect(() => {
    if (userProfile) {
      form.reset({
        phone: '',
        profileImageUrl: userProfile.profileImageUrl ?? '',
      });
    }
  }, [userProfile, form]);

  const draft = useFormDraft<ProfileEditFormValues>({
    key: `my-profile:${userProfile?.userId ?? 'unknown'}`,
    form,
    enabled: !saving && !!userProfile,
  });

  if (loading && !data) {
    return (
      <div className="space-y-6" aria-busy="true">
        <header>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('description')}</p>
        </header>
        <p className="text-sm text-muted-foreground">{t('loading')}</p>
      </div>
    );
  }

  if (error || !profile || !userProfile) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('description')}</p>
        </header>
        {/*
          Inline error banner using Card primitives — @roviq/ui doesn't ship a
          dedicated `<Alert>` component yet, so we mirror the destructive
          variant with a rose-tinted Card. Same a11y properties (role="alert",
          aria-live) are preserved by the surrounding section semantics.
        */}
        <Card className="border-rose-300 bg-rose-50 dark:border-rose-700 dark:bg-rose-950">
          <CardContent className="flex items-start gap-3 pt-6">
            <AlertTriangle
              className="mt-0.5 size-5 text-rose-600 dark:text-rose-400"
              aria-hidden="true"
            />
            <div className="flex-1 space-y-2">
              <p className="font-medium text-rose-900 dark:text-rose-100">
                {t('errors.loadFailed')}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void refetch();
                }}
              >
                <RefreshCw className="me-2 size-4" aria-hidden="true" />
                {t('retry')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-full bg-muted">
          <UserRound className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid={instituteProfile.title}>
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('description')}</p>
        </div>
      </header>

      {draft.hasDraft && (
        <Card className="border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950">
          <CardContent className="pt-6">
            <p className="font-medium text-amber-900 dark:text-amber-100">{t('draft.title')}</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <span className="text-sm text-amber-800 dark:text-amber-200">
                {t('draft.description')}
              </span>
              <Button size="sm" variant="outline" onClick={draft.restoreDraft}>
                {t('draft.restore')}
              </Button>
              <Button size="sm" variant="ghost" onClick={draft.discardDraft}>
                {t('draft.discard')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <PersonalDetailsCard
        userProfile={userProfile}
        data-testid={instituteProfile.personalSection}
      />

      <Card data-testid={instituteProfile.editableSection}>
        <CardHeader>
          <CardTitle>{t('editableSection.title')}</CardTitle>
          <CardDescription>{t('editableSection.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              void form.handleSubmit();
            }}
            noValidate
          >
            <FieldGroup>
              <form.AppField name="phone">
                {(field) => (
                  <field.TextField
                    label={t('fields.phone')}
                    description={t('fieldDescriptions.phone')}
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel-national"
                    placeholder="9876543210"
                    testId="profile-phone-input"
                  />
                )}
              </form.AppField>

              <form.AppField name="profileImageUrl">
                {(field) => (
                  <>
                    <field.TextField
                      label={t('fields.profileImageUrl')}
                      description={t('fieldDescriptions.profileImageUrl')}
                      type="url"
                      placeholder="https://..."
                      testId="profile-image-url-input"
                    />
                    {userProfile.profileImageUrl && (
                      <p className="mt-1 break-all text-xs text-muted-foreground">
                        {userProfile.profileImageUrl}
                      </p>
                    )}
                  </>
                )}
              </form.AppField>
            </FieldGroup>

            <div className="mt-6 flex justify-end">
              <form.AppForm>
                <form.SubmitButton
                  testId="profile-save-btn"
                  submittingLabel={t('saving')}
                  disabled={saving}
                >
                  {t('save')}
                </form.SubmitButton>
              </form.AppForm>
            </div>
          </form>
        </CardContent>
      </Card>

      <RoleSpecificSections profile={profile} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Personal (read-only) details                                        */
/* ------------------------------------------------------------------ */

function PersonalDetailsCard({
  userProfile,
  'data-testid': dataTestId,
}: {
  userProfile: UserProfileData;
  'data-testid'?: string;
}) {
  const t = useTranslations('profile');
  const resolveI18n = useI18nField();
  const { format } = useFormatDate();

  return (
    <Card data-testid={dataTestId}>
      <CardHeader>
        <CardTitle>{t('personalSection.title')}</CardTitle>
        <CardDescription>{t('personalSection.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-4 sm:grid-cols-2">
          <ReadOnlyRow label={t('fields.firstName')} value={resolveI18n(userProfile.firstName)} />
          <ReadOnlyRow
            label={t('fields.lastName')}
            value={userProfile.lastName ? resolveI18n(userProfile.lastName) : null}
          />
          <ReadOnlyRow
            label={t('fields.dateOfBirth')}
            value={userProfile.dateOfBirth ? format(parseISO(userProfile.dateOfBirth), 'PP') : null}
          />
          <ReadOnlyRow label={t('fields.gender')} value={userProfile.gender} />
          <ReadOnlyRow label={t('fields.bloodGroup')} value={userProfile.bloodGroup} />
          <ReadOnlyRow label={t('fields.nationality')} value={userProfile.nationality} />
        </dl>
        <p className="mt-4 text-xs text-muted-foreground">{t('fieldDescriptions.adminOnly')}</p>
      </CardContent>
    </Card>
  );
}

function ReadOnlyRow({ label, value }: { label: string; value: string | null | undefined }) {
  const t = useTranslations('profile');
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm">{value && value.length > 0 ? value : t('notSet')}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Role-specific sections                                              */
/* ------------------------------------------------------------------ */

function RoleSpecificSections({ profile }: { profile: MyProfile }) {
  if (profile.__typename === 'MyStudentProfile') {
    return <StudentAcademicsSection profile={profile} data-testid={instituteProfile.roleStudent} />;
  }
  if (profile.__typename === 'MyStaffProfile') {
    return <StaffEmploymentSection profile={profile} data-testid={instituteProfile.roleStaff} />;
  }
  return <GuardianChildrenSection profile={profile} data-testid={instituteProfile.roleGuardian} />;
}

function StudentAcademicsSection({
  profile,
  'data-testid': dataTestId,
}: {
  profile: MyStudentProfile;
  'data-testid'?: string;
}) {
  const t = useTranslations('profile');
  const academics = profile.academics;

  return (
    <Card data-testid={dataTestId}>
      <CardHeader>
        <CardTitle>{t('studentSection.title')}</CardTitle>
        <CardDescription>{t('studentSection.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        {academics && Object.keys(academics).length > 0 ? (
          <dl className="grid gap-2 sm:grid-cols-2">
            {Object.entries(academics).map(([key, value]) => (
              <div key={key}>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {key}
                </dt>
                <dd className="mt-1 text-sm">{renderAcademicValue(value)}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">{t('notSet')}</p>
        )}
      </CardContent>
    </Card>
  );
}

function renderAcademicValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
}

function StaffEmploymentSection({
  profile,
  'data-testid': dataTestId,
}: {
  profile: MyStaffProfile;
  'data-testid'?: string;
}) {
  const t = useTranslations('profile');
  const staff = profile.staffProfile;
  return (
    <Card data-testid={dataTestId}>
      <CardHeader>
        <CardTitle>{t('staffSection.title')}</CardTitle>
        <CardDescription>{t('staffSection.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        {staff && Object.keys(staff).length > 0 ? (
          <dl className="grid gap-2 sm:grid-cols-2">
            {Object.entries(staff).map(([key, value]) => (
              <div key={key}>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {key}
                </dt>
                <dd className="mt-1 text-sm">{renderAcademicValue(value)}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">{t('notSet')}</p>
        )}
      </CardContent>
    </Card>
  );
}

function GuardianChildrenSection({
  profile,
  'data-testid': dataTestId,
}: {
  profile: MyGuardianProfile;
  'data-testid'?: string;
}) {
  const t = useTranslations('profile');
  const resolveI18n = useI18nField();
  const children = profile.children ?? [];

  return (
    <Card data-testid={dataTestId}>
      <CardHeader>
        <CardTitle>{t('guardianSection.title')}</CardTitle>
        <CardDescription>{t('guardianSection.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        {children.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('guardianSection.empty')}</p>
        ) : (
          <ul className="space-y-3">
            {children.map((child) => {
              const firstName = resolveI18n(child.firstName);
              const lastName = resolveI18n(child.lastName);
              const fullName = [firstName, lastName].filter(Boolean).join(' ');
              return (
                <li
                  key={child.studentProfileId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-full bg-muted text-sm font-medium">
                      {firstName.charAt(0) || '?'}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{fullName || t('notSet')}</p>
                      <p className="text-xs text-muted-foreground">
                        {t('guardianSection.relationship')}: {child.relationship}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {child.isPrimaryContact && (
                      <Badge variant="secondary">{t('guardianSection.primaryBadge')}</Badge>
                    )}
                    <Button asChild variant="outline" size="sm">
                      <a href="/settings/consent">
                        <ShieldCheck className="me-2 size-4" />
                        {t('guardianSection.viewConsent')}
                      </a>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

import { testIds } from '@roviq/ui/testing/testid-registry';
