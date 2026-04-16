'use client';

import { gql, useQuery } from '@roviq/graphql';
import { useI18nField } from '@roviq/i18n';
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@roviq/ui';
import { Users } from 'lucide-react';
import { useTranslations } from 'next-intl';

const LIST_INSTITUTE_USERS = gql`
  query AdminListInstituteUsers($tenantId: String!) {
    adminListUsers(filter: { tenantId: $tenantId, first: 50 }) {
      totalCount
      edges {
        node {
          id
          username
          email
          status
          profile {
            firstName
            lastName
          }
          memberships {
            id
            tenantId
            status
            roleId
            instituteName
          }
        }
      }
    }
  }
`;

interface MembershipNode {
  id: string;
  tenantId: string;
  status: string;
  roleId: string;
  instituteName?: string | null;
}

interface UserNode {
  id: string;
  username: string;
  email: string;
  status: string;
  profile?: {
    firstName: Record<string, string>;
    lastName?: Record<string, string> | null;
  } | null;
  memberships: MembershipNode[];
}

interface Data {
  adminListUsers: {
    totalCount: number;
    edges: Array<{ node: UserNode }>;
  };
}

export function InstituteUsersTab({ instituteId }: { instituteId: string }) {
  const t = useTranslations('adminInstitutes.users');
  const resolveI18n = useI18nField();
  const { data, loading } = useQuery<Data>(LIST_INSTITUTE_USERS, {
    variables: { tenantId: instituteId },
    fetchPolicy: 'cache-and-network',
  });

  if (loading && !data) {
    return <Skeleton className="h-64 w-full" />;
  }

  const users = data?.adminListUsers.edges.map((e) => e.node) ?? [];

  if (users.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Empty className="py-8">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Users />
              </EmptyMedia>
              <EmptyTitle>{t('emptyTitle')}</EmptyTitle>
              <EmptyDescription>{t('emptyDescription')}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="users-tab">
      <CardHeader>
        <CardTitle>
          {t('title')}
          <span className="ms-2 text-sm font-normal text-muted-foreground">
            ({data?.adminListUsers.totalCount ?? 0})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('columns.name')}</TableHead>
              <TableHead>{t('columns.username')}</TableHead>
              <TableHead>{t('columns.email')}</TableHead>
              <TableHead>{t('columns.roles')}</TableHead>
              <TableHead>{t('columns.status')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => {
              const name = user.profile
                ? `${resolveI18n(user.profile.firstName)}${
                    user.profile.lastName ? ` ${resolveI18n(user.profile.lastName)}` : ''
                  }`
                : user.username;
              const membershipsInInstitute = user.memberships.filter(
                (m) => m.tenantId === instituteId,
              );
              return (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{name}</TableCell>
                  <TableCell className="font-mono text-xs">{user.username}</TableCell>
                  <TableCell className="text-sm">{user.email}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {membershipsInInstitute.map((m) => (
                        <Badge key={m.id} variant="outline" className="text-xs">
                          {m.roleId}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.status === 'ACTIVE' ? 'default' : 'secondary'}>
                      {user.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
