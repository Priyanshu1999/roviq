'use client';

import { extractGraphQLError } from '@roviq/graphql';
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
  Can,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@roviq/ui';
import { ArrowLeft, Building, Building2, Info, Loader2, Pencil, Trash2 } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import {
  useDeleteInstituteGroup,
  useInstituteGroup,
  useUpdateInstituteGroup,
} from '../use-institute-groups';

// ─── Badge color maps ───────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  TRUST: 'bg-amber-100 text-amber-700',
  SOCIETY: 'bg-blue-100 text-blue-700',
  CHAIN: 'bg-violet-100 text-violet-700',
  FRANCHISE: 'bg-emerald-100 text-emerald-700',
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  INACTIVE: 'bg-zinc-100 text-zinc-500',
  SUSPENDED: 'bg-red-100 text-red-700',
};

interface EditGroupForm {
  name: string;
  registrationNumber: string;
  registrationState: string;
  version: number;
}

export default function InstituteGroupDetailPage() {
  const t = useTranslations('instituteGroups');
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { group, loading, refetch } = useInstituteGroup(id);
  const [deleteGroup, { loading: deleting }] = useDeleteInstituteGroup();
  const [updateGroup, { loading: updating }] = useUpdateInstituteGroup();
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);

  const editForm = useForm<EditGroupForm>();

  /** Open the edit sheet and populate form with current group data. */
  const openEdit = React.useCallback(() => {
    if (!group) return;
    editForm.reset({
      name: group.name,
      registrationNumber: group.registrationNumber ?? '',
      registrationState: group.registrationState ?? '',
      version: group.version,
    });
    setEditOpen(true);
  }, [group, editForm]);

  const handleEdit = async (data: EditGroupForm) => {
    try {
      await updateGroup({
        variables: {
          id,
          input: {
            name: data.name,
            registrationNumber: data.registrationNumber || undefined,
            registrationState: data.registrationState || undefined,
            version: data.version,
          },
        },
      });
      toast.success(t('updated'));
      setEditOpen(false);
      refetch();
    } catch (err) {
      toast.error(extractGraphQLError(err, t('updateFailed')));
    }
  };

  const handleDelete = async () => {
    try {
      await deleteGroup({ variables: { id } });
      toast.success(t('deleted'));
      router.push('/admin/institute-groups');
    } catch (err) {
      toast.error(extractGraphQLError(err, t('deleteFailed')));
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">{t('noGroups')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/admin/institute-groups')}
            className="gap-1.5"
          >
            <ArrowLeft className="size-4" />
            {t('back')}
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{group.name}</h1>
              <Badge
                variant="secondary"
                className={`text-xs border-0 ${TYPE_COLORS[group.type] ?? ''}`}
              >
                {t(`types.${group.type}` as Parameters<typeof t>[0])}
              </Badge>
              <Badge
                variant="secondary"
                className={`text-xs border-0 ${STATUS_COLORS[group.status] ?? ''}`}
              >
                {t(`statuses.${group.status}` as Parameters<typeof t>[0])}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {group.code}
              {group.registrationNumber && ` · ${group.registrationNumber}`}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Can I="update" a="InstituteGroup">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={openEdit}>
              <Pencil className="size-3.5" />
              {t('editGroup')}
            </Button>
          </Can>
          <Can I="delete" a="InstituteGroup">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="size-3.5" />
              {t('deleteGroup')}
            </Button>
          </Can>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="institutes">
        <TabsList>
          <TabsTrigger value="institutes" className="gap-1.5">
            <Building className="size-3.5" />
            {t('tabs.institutes')}
          </TabsTrigger>
          <TabsTrigger value="info" className="gap-1.5">
            <Info className="size-3.5" />
            {t('tabs.info')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="institutes" className="mt-4">
          <Empty className="py-12">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Building2 />
              </EmptyMedia>
              <EmptyTitle>{t('noInstitutes')}</EmptyTitle>
              <EmptyDescription>{t('description')}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </TabsContent>

        <TabsContent value="info" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('tabs.info')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">{t('name')}</p>
                  <p className="font-medium">{group.name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t('code')}</p>
                  <p className="font-medium">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{group.code}</code>
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t('type')}</p>
                  <p className="font-medium">
                    {t(`types.${group.type}` as Parameters<typeof t>[0])}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t('status')}</p>
                  <p className="font-medium">
                    {t(`statuses.${group.status}` as Parameters<typeof t>[0])}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t('registrationNumber')}</p>
                  <p className="font-medium">{group.registrationNumber ?? '---'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t('registrationState')}</p>
                  <p className="font-medium">{group.registrationState ?? '---'}</p>
                </div>
              </div>
              {group.contact && Object.keys(group.contact).length > 0 && (
                <div className="text-sm">
                  <p className="text-muted-foreground">{t('contact')}</p>
                  <pre className="text-xs bg-muted p-2 rounded mt-1">
                    {JSON.stringify(group.contact, null, 2)}
                  </pre>
                </div>
              )}
              {group.address && Object.keys(group.address).length > 0 && (
                <div className="text-sm">
                  <p className="text-muted-foreground">{t('address')}</p>
                  <pre className="text-xs bg-muted p-2 rounded mt-1">
                    {JSON.stringify(group.address, null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit sheet */}
      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{t('editGroup')}</SheetTitle>
          </SheetHeader>
          <form onSubmit={editForm.handleSubmit(handleEdit)} className="space-y-5 p-4">
            <input type="hidden" {...editForm.register('version', { valueAsNumber: true })} />
            <FieldGroup>
              <Field>
                <FieldLabel>{t('name')}</FieldLabel>
                <Input {...editForm.register('name', { required: true })} />
                {editForm.formState.errors.name && (
                  <FieldError>{editForm.formState.errors.name.message}</FieldError>
                )}
              </Field>
              <Field>
                <FieldLabel>{t('registrationNumber')}</FieldLabel>
                <Input {...editForm.register('registrationNumber')} />
              </Field>
              <Field>
                <FieldLabel>{t('registrationState')}</FieldLabel>
                <Input {...editForm.register('registrationState')} />
              </Field>
            </FieldGroup>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={updating}>
                {updating && <Loader2 className="me-2 size-4 animate-spin" />}
                {t('saveChanges')}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={(o) => !o && setDeleteOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteGroup')}</AlertDialogTitle>
            <AlertDialogDescription>{t('deleteConfirm', { count: 0 })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
