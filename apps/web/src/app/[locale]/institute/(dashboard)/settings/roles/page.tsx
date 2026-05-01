'use client';

import { gql, useQuery } from '@roviq/graphql';
import { useI18nField } from '@roviq/i18n';
import {
  Badge,
  Button,
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  PageHeader,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useAbility,
} from '@roviq/ui';
import { testIds } from '@web/testing/testid-registry';
import { ListTree, ShieldOff, Sliders } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { CustomizeNavSheet } from './customize-nav-sheet';
import type { InstituteRolesQuery } from './page.generated';

const INSTITUTE_ROLES_QUERY = gql`
  query InstituteRoles {
    instituteRoles {
      id
      name
      isDefault
      isSystem
      primaryNavSlugs
    }
  }
`;

type Role = InstituteRolesQuery['instituteRoles'][number];

export default function RolePrimaryNavPage() {
  const t = useTranslations('settings.roles');
  const tNav = useTranslations('nav');
  const ti = useI18nField();
  const ability = useAbility();

  const canRead = ability.can('read', 'Role');
  const canUpdate = ability.can('update', 'Role');

  const { data, loading, error, refetch } = useQuery<InstituteRolesQuery>(INSTITUTE_ROLES_QUERY, {
    skip: !canRead,
  });

  const [activeRole, setActiveRole] = useState<Role | null>(null);

  // CASL gate — institute_admin only by design. Show a friendly empty state
  // for other roles instead of a hard 403, so the link in the sidebar isn't
  // a dead end if someone navigates here directly.
  if (!canUpdate) {
    return (
      <div className="space-y-6">
        <PageHeader title={t('title')} description={t('description')} />
        <Empty data-testid={testIds.instituteRoles.forbidden}>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ShieldOff />
            </EmptyMedia>
            <EmptyTitle>{t('forbiddenTitle')}</EmptyTitle>
            <EmptyDescription>{t('forbiddenDescription')}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  function labelForSlug(slug: string): string {
    try {
      return tNav(slug as Parameters<typeof tNav>[0]);
    } catch {
      return slug;
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} description={t('description')} />

      {error && (
        <Empty data-testid={testIds.instituteRoles.error}>
          <EmptyHeader>
            <EmptyTitle>{t('loadFailedTitle')}</EmptyTitle>
            <EmptyDescription>{t('loadFailedDescription')}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" onClick={() => refetch()}>
              {t('retry')}
            </Button>
          </EmptyContent>
        </Empty>
      )}

      {loading && !data && (
        <div className="flex items-center justify-center py-12">
          <Spinner className="size-6" />
        </div>
      )}

      {data && data.instituteRoles.length === 0 && (
        <Empty data-testid={testIds.instituteRoles.empty}>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ListTree />
            </EmptyMedia>
            <EmptyTitle>{t('emptyTitle')}</EmptyTitle>
            <EmptyDescription>{t('emptyDescription')}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {data && data.instituteRoles.length > 0 && (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('columnRoleName')}</TableHead>
                <TableHead>{t('columnPrimaryNav')}</TableHead>
                <TableHead className="w-[1%] text-right">{t('columnAction')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.instituteRoles.map((role) => (
                <TableRow key={role.id} data-testid={testIds.instituteRoles.row(role.id)}>
                  <TableCell className="font-medium">
                    <div className="flex flex-col gap-1">
                      <span>{ti(role.name)}</span>
                      <div className="flex gap-1">
                        {role.isSystem && (
                          <Badge variant="outline" className="w-fit text-xs">
                            {t('systemBadge')}
                          </Badge>
                        )}
                        {role.isDefault && (
                          <Badge variant="secondary" className="w-fit text-xs">
                            {t('defaultBadge')}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {role.primaryNavSlugs.length === 0 ? (
                      <span className="text-sm italic text-muted-foreground">
                        {t('usingPortalDefaults')}
                      </span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {role.primaryNavSlugs.map((slug, idx) => (
                          <Badge key={slug} variant="secondary" className="gap-1.5">
                            <span className="font-mono text-xs tabular-nums opacity-60">
                              {idx + 1}
                            </span>
                            {labelForSlug(slug)}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveRole(role)}
                      data-testid={testIds.instituteRoles.customize(role.id)}
                    >
                      <Sliders className="me-2 size-3.5" aria-hidden="true" />
                      {t('customizeBottomNav')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {activeRole && (
        <CustomizeNavSheet
          open={Boolean(activeRole)}
          onOpenChange={(open) => {
            if (!open) setActiveRole(null);
          }}
          roleId={activeRole.id}
          roleName={ti(activeRole.name)}
          roleNameEn={activeRole.name.en ?? ''}
          initialSlugs={activeRole.primaryNavSlugs}
          onSaved={() => {
            void refetch();
          }}
        />
      )}
    </div>
  );
}
