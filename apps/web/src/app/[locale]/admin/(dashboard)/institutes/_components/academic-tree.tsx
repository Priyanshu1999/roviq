'use client';

import { gql, useQuery } from '@roviq/graphql';
import { useI18nField } from '@roviq/i18n';
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
} from '@roviq/ui';
import { useTranslations } from 'next-intl';

const GET_ACADEMIC_TREE = gql`
  query AdminGetInstituteAcademicTree($instituteId: ID!) {
    adminGetInstituteAcademicTree(instituteId: $instituteId) {
      instituteId
      academicYearId
      standards {
        id
        name
        department
        sections {
          id
          name
          stream
        }
        subjects {
          id
          name
          shortName
          boardCode
          type
        }
      }
    }
  }
`;

interface Subject {
  id: string;
  name: string;
  shortName?: string | null;
  boardCode?: string | null;
  type: string;
}

interface Section {
  id: string;
  name: Record<string, string>;
  stream?: Record<string, unknown> | null;
}

interface Standard {
  id: string;
  name: Record<string, string>;
  department?: string | null;
  sections: Section[];
  subjects: Subject[];
}

interface Data {
  adminGetInstituteAcademicTree: {
    instituteId: string;
    academicYearId: string | null;
    standards: Standard[];
  };
}

export function AcademicTreeTab({ instituteId }: { instituteId: string }) {
  const t = useTranslations('adminInstitutes.academic');
  const resolveI18n = useI18nField();
  const { data, loading } = useQuery<Data>(GET_ACADEMIC_TREE, {
    variables: { instituteId },
  });

  if (loading && !data) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  const tree = data?.adminGetInstituteAcademicTree;
  if (!tree || tree.standards.length === 0) {
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

  // Group standards by department
  const groups = new Map<string, Standard[]>();
  for (const std of tree.standards) {
    const key = std.department ?? '__none__';
    const list = groups.get(key) ?? [];
    list.push(std);
    groups.set(key, list);
  }

  return (
    <Card data-testid="academic-tree-tab">
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {Array.from(groups.entries()).map(([dept, stds]) => (
          <div key={dept} className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">
              {dept === '__none__'
                ? t('noDepartment')
                : t(`departments.${dept}`, { defaultValue: dept })}
            </h3>
            <div className="space-y-3 pl-2">
              {stds.map((std) => (
                <div key={std.id} className="rounded-lg border p-3">
                  <p className="font-medium">{resolveI18n(std.name)}</p>
                  {std.sections.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      <span className="text-xs text-muted-foreground">{t('sections')}:</span>
                      {std.sections.map((sec) => (
                        <Badge key={sec.id} variant="outline" className="text-xs">
                          {resolveI18n(sec.name)}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {std.subjects.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      <span className="text-xs text-muted-foreground">{t('subjects')}:</span>
                      {std.subjects.map((sub) => (
                        <Badge
                          key={sub.id}
                          variant={sub.type === 'ACADEMIC' ? 'secondary' : 'outline'}
                          className="text-xs"
                        >
                          {sub.shortName ?? sub.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
