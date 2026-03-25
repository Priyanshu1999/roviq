'use client';

import { extractGraphQLError } from '@roviq/graphql';
import {
  Button,
  Can,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Field,
  FieldGroup,
  FieldLabel,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@roviq/ui';
import { FolderOpen, Loader2, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { toast } from 'sonner';
import {
  useResellerCreateInstituteGroup,
  useResellerInstituteGroups,
} from '../institutes/use-reseller-institutes';

const GROUP_TYPES = ['TRUST', 'CHAIN', 'SOCIETY', 'OTHER'] as const;

export default function InstituteGroupsPage() {
  const t = useTranslations('resellerInstitutes.groups');
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [code, setCode] = React.useState('');
  const [groupType, setGroupType] = React.useState<string>('TRUST');
  const [registrationNumber, setRegistrationNumber] = React.useState('');
  const [registrationState, setRegistrationState] = React.useState('');

  const { data, loading } = useResellerInstituteGroups();
  const [createGroup, { loading: creating }] = useResellerCreateInstituteGroup();

  const groups = Array.isArray(data?.resellerListInstituteGroups)
    ? (data.resellerListInstituteGroups as Array<Record<string, unknown>>)
    : [];

  const handleCreate = async () => {
    try {
      await createGroup({
        variables: {
          input: {
            name,
            code,
            type: groupType,
            ...(registrationNumber ? { registrationNumber } : {}),
            ...(registrationState ? { registrationState } : {}),
          },
        },
      });
      toast.success(t('create.success'));
      setDialogOpen(false);
      setName('');
      setCode('');
      setRegistrationNumber('');
      setRegistrationState('');
    } catch (err) {
      toast.error(t('create.error'), { description: extractGraphQLError(err, t('create.error')) });
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">{t('description')}</p>
        </div>
        <Can I="create" a="InstituteGroup">
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="size-4" />
            {t('createGroup')}
          </Button>
        </Can>
      </div>

      {groups.length === 0 ? (
        <Empty className="py-12">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FolderOpen />
            </EmptyMedia>
            <EmptyTitle>{t('empty.title')}</EmptyTitle>
            <EmptyDescription>{t('empty.description')}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('columns.name')}</TableHead>
                  <TableHead>{t('columns.code')}</TableHead>
                  <TableHead>{t('columns.type')}</TableHead>
                  <TableHead>{t('registrationNumber')}</TableHead>
                  <TableHead>{t('columns.count')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((group) => (
                  <TableRow key={String(group.id)}>
                    <TableCell className="font-medium">{String(group.name ?? '')}</TableCell>
                    <TableCell className="font-mono text-xs">{String(group.code ?? '')}</TableCell>
                    <TableCell>{String(group.type ?? '')}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {String(group.registrationNumber ?? '\u2014')}
                    </TableCell>
                    <TableCell>{String(group.instituteCount ?? '0')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>{t('create.title')}</DialogTitle>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel>{t('create.name')}</FieldLabel>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('create.namePlaceholder')}
              />
            </Field>
            <Field>
              <FieldLabel>{t('create.code')}</FieldLabel>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={t('create.codePlaceholder')}
              />
            </Field>
            <Field>
              <FieldLabel>{t('create.type')}</FieldLabel>
              <Select value={groupType} onValueChange={setGroupType}>
                <SelectTrigger>
                  <SelectValue placeholder={t('create.typePlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {GROUP_TYPES.map((gt) => (
                    <SelectItem key={gt} value={gt}>
                      {gt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>{t('registrationNumber')}</FieldLabel>
              <Input
                value={registrationNumber}
                onChange={(e) => setRegistrationNumber(e.target.value)}
                placeholder={t('registrationNumberPlaceholder')}
              />
            </Field>
            <Field>
              <FieldLabel>{t('registrationState')}</FieldLabel>
              <Input
                value={registrationState}
                onChange={(e) => setRegistrationState(e.target.value)}
                placeholder={t('registrationStatePlaceholder')}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button onClick={handleCreate} disabled={creating || !name || !code}>
              {creating ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t('create.creating')}
                </>
              ) : (
                t('create.submit')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
