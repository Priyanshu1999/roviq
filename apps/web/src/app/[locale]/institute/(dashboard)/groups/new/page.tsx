'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { DOMAIN_GROUP_TYPE_VALUES, GROUP_MEMBERSHIP_TYPE_VALUES } from '@roviq/common-types';
import type { DomainGroupType, GroupMembershipType } from '@roviq/graphql/generated';
import { useI18nField } from '@roviq/i18n';
import {
  Badge,
  Button,
  Card,
  CardContent,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  useDebounce,
} from '@roviq/ui';
import { ArrowLeft, ArrowRight, Check, Plus, Search, Trash2, UserPlus, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { FormProvider, useForm, useFormContext } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { useGuardians } from '../../people/guardians/use-guardians';
import { useStaff } from '../../people/staff/use-staff';
import { useStudents } from '../../people/students/use-students';
import { type GroupRule, useCreateGroup, usePreviewGroupRule } from '../use-groups';

// ─── Constants ──────────────────────────────────────────────────────────────

const MEMBER_TYPES = ['student', 'staff', 'guardian'] as const;

const DIMENSION_OPTIONS = [
  'gender',
  'standard_id',
  'section_id',
  'social_category',
  'is_rte_admitted',
  'religion',
  'is_cwsn',
  'is_minority',
  'is_bpl',
  'mother_tongue',
] as const;

const OPERATOR_OPTIONS = ['==', '!=', 'in', '>', '<', '>=', '<='] as const;

type Operator = (typeof OPERATOR_OPTIONS)[number];
type Combinator = 'and' | 'or' | 'not';
type MemberType = (typeof MEMBER_TYPES)[number];

interface RuleCondition {
  id: string;
  dimension: string;
  operator: Operator;
  value: string;
}

interface RuleNode {
  id: string;
  combinator: Combinator;
  conditions: RuleCondition[];
  children: RuleNode[];
}

interface SelectedMember {
  id: string;
  memberType: MemberType;
  displayName: string;
}

// ─── Schema ─────────────────────────────────────────────────────────────────

const basicsSchema = z.object({
  name: z.string().trim().min(1),
  type: z.enum(DOMAIN_GROUP_TYPE_VALUES),
  membershipType: z.enum(GROUP_MEMBERSHIP_TYPE_VALUES),
  memberTypes: z.array(z.enum(MEMBER_TYPES)).min(1),
});

type BasicsFormValues = z.infer<typeof basicsSchema>;

// ─── Helpers ────────────────────────────────────────────────────────────────

function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function emptyCondition(): RuleCondition {
  return { id: newId(), dimension: 'gender', operator: '==', value: '' };
}

function emptyNode(combinator: Combinator = 'and'): RuleNode {
  return { id: newId(), combinator, conditions: [emptyCondition()], children: [] };
}

/**
 * Convert the editor's tree representation to a JsonLogic expression.
 * Skips empty conditions (no value). Returns an empty object when the
 * whole tree is empty so the backend can reject it cleanly.
 */
function nodeToJsonLogic(node: RuleNode): GroupRule {
  const parts: GroupRule[] = [];

  for (const c of node.conditions) {
    if (c.value.trim() === '') continue;
    const operand: GroupRule = { [c.operator]: [{ var: c.dimension }, coerceValue(c.value)] };
    parts.push(operand);
  }
  for (const child of node.children) {
    const childLogic = nodeToJsonLogic(child);
    if (Object.keys(childLogic).length > 0) parts.push(childLogic);
  }

  if (parts.length === 0) return {};
  if (node.combinator === 'not') {
    return { '!': parts[0] ?? {} };
  }
  return { [node.combinator]: parts };
}

/** Try to coerce a literal to boolean/number before falling back to string. */
function coerceValue(raw: string): string | number | boolean {
  const trimmed = raw.trim();
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  return trimmed;
}

// ─── Page ───────────────────────────────────────────────────────────────────

type Step = 'basics' | 'rule' | 'members';

export default function NewGroupPage() {
  const t = useTranslations('groups');
  const router = useRouter();
  const [createGroup, { loading: creating }] = useCreateGroup();

  const methods = useForm<BasicsFormValues>({
    resolver: zodResolver(basicsSchema),
    defaultValues: {
      name: '',
      type: undefined,
      membershipType: 'STATIC',
      memberTypes: ['student'],
    },
    mode: 'onBlur',
  });

  const membershipType = methods.watch('membershipType');
  const memberTypes = methods.watch('memberTypes');

  const [step, setStep] = React.useState<Step>('basics');
  const [rootNode, setRootNode] = React.useState<RuleNode>(() => emptyNode('and'));
  const [selectedMembers, setSelectedMembers] = React.useState<SelectedMember[]>([]);

  const needsRule = membershipType === 'DYNAMIC' || membershipType === 'HYBRID';
  const needsMembers = membershipType === 'STATIC' || membershipType === 'HYBRID';

  const steps: Step[] = React.useMemo(() => {
    const s: Step[] = ['basics'];
    if (needsRule) s.push('rule');
    if (needsMembers) s.push('members');
    return s;
  }, [needsRule, needsMembers]);

  const stepIndex = steps.indexOf(step);

  React.useEffect(() => {
    // If the user changes membershipType such that the current step no
    // longer exists, snap back to the first step.
    if (!steps.includes(step)) {
      setStep(steps[0] ?? 'basics');
    }
  }, [steps, step]);

  const goNext = async () => {
    if (step === 'basics') {
      const valid = await methods.trigger();
      if (!valid) return;
    }
    const next = steps[stepIndex + 1];
    if (next) setStep(next);
  };

  const goPrev = () => {
    const prev = steps[stepIndex - 1];
    if (prev) setStep(prev);
  };

  const handleSubmit = methods.handleSubmit(async (values) => {
    try {
      const rule = needsRule ? nodeToJsonLogic(rootNode) : undefined;
      if (needsRule && Object.keys(rule ?? {}).length === 0) {
        toast.error(t('new.rule.previewError'));
        return;
      }
      const result = await createGroup({
        variables: {
          input: {
            name: values.name,
            groupType: values.type,
            membershipType: values.membershipType,
            memberTypes: values.memberTypes,
            rule,
          },
        },
      });
      const created = result.data?.createGroup;
      if (!created) throw new Error(t('new.createError'));
      toast.success(t('new.createSuccess'));
      router.push(`/institute/groups/${created.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('new.createError'));
    }
  });

  const isLastStep = stepIndex === steps.length - 1;

  return (
    <FormProvider {...methods}>
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/institute/groups')}
            className="mb-2"
          >
            <ArrowLeft className="size-4" />
            {t('actions.back')}
          </Button>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="groups-new-title">
            {t('new.title')}
          </h1>
          <p className="text-muted-foreground">{t('new.description')}</p>
        </div>

        <Stepper steps={steps} currentIndex={stepIndex} />

        <Card>
          <CardContent className="pt-6">
            {step === 'basics' && <BasicsStep />}
            {step === 'rule' && <RuleStep rootNode={rootNode} onChange={setRootNode} />}
            {step === 'members' && (
              <MembersStep
                memberTypes={memberTypes}
                selected={selectedMembers}
                onSelectedChange={setSelectedMembers}
              />
            )}
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={goPrev}
            disabled={stepIndex === 0 || creating}
            data-testid="groups-new-prev-btn"
          >
            <ArrowLeft className="size-4" />
            {t('actions.previous')}
          </Button>
          {isLastStep ? (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={creating}
              data-testid="groups-new-submit-btn"
            >
              <Check className="size-4" />
              {creating ? t('actions.saving') : t('actions.finish')}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={goNext}
              disabled={creating}
              data-testid="groups-new-next-btn"
            >
              {t('actions.next')}
              <ArrowRight className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </FormProvider>
  );
}

// ─── Stepper ────────────────────────────────────────────────────────────────

function Stepper({ steps, currentIndex }: { steps: Step[]; currentIndex: number }) {
  const t = useTranslations('groups');
  return (
    <nav aria-label="Progress" className="flex items-center gap-2">
      {steps.map((s, i) => {
        const active = i === currentIndex;
        const done = i < currentIndex;
        return (
          <React.Fragment key={s}>
            {i > 0 && <Separator className="w-6" />}
            <div
              className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm ${
                active
                  ? 'bg-primary text-primary-foreground'
                  : done
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground'
              }`}
              aria-current={active ? 'step' : undefined}
            >
              <span className="inline-flex size-5 items-center justify-center rounded-full border text-xs tabular-nums">
                {i + 1}
              </span>
              <span>{t(`new.steps.${s}`)}</span>
            </div>
          </React.Fragment>
        );
      })}
    </nav>
  );
}

// ─── Step 1: Basics ─────────────────────────────────────────────────────────

function BasicsStep() {
  const t = useTranslations('groups');
  const form = useFormContext<BasicsFormValues>();

  const name = form.watch('name');
  const type = form.watch('type');
  const membershipType = form.watch('membershipType');
  const memberTypes = form.watch('memberTypes');

  const toggleMemberType = (mt: MemberType) => {
    const next = memberTypes.includes(mt)
      ? memberTypes.filter((x) => x !== mt)
      : [...memberTypes, mt];
    form.setValue('memberTypes', next, { shouldValidate: true });
  };

  return (
    <FieldGroup>
      <FieldSet>
        <FieldLegend>{t('new.basics.sectionTitle')}</FieldLegend>
        <FieldDescription>{t('new.basics.sectionDescription')}</FieldDescription>

        <Field>
          <FieldLabel htmlFor="group-name">{t('new.basics.name')}</FieldLabel>
          <Input
            id="group-name"
            data-testid="groups-new-name-input"
            value={name}
            onChange={(e) => form.setValue('name', e.target.value, { shouldValidate: true })}
            placeholder={t('new.basics.namePlaceholder')}
            aria-invalid={Boolean(form.formState.errors.name)}
          />
          {form.formState.errors.name && (
            <FieldError>{t('new.basics.errors.nameRequired')}</FieldError>
          )}
        </Field>

        <Field>
          <FieldLabel htmlFor="group-type">{t('new.basics.type')}</FieldLabel>
          <Select
            value={type}
            onValueChange={(v) =>
              form.setValue('type', v as DomainGroupType, {
                shouldValidate: true,
              })
            }
          >
            <SelectTrigger id="group-type" data-testid="groups-new-type-select">
              <SelectValue placeholder={t('new.basics.typePlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {DOMAIN_GROUP_TYPE_VALUES.map((gt) => (
                <SelectItem key={gt} value={gt}>
                  {t(`types.${gt}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {form.formState.errors.type && (
            <FieldError>{t('new.basics.errors.typeRequired')}</FieldError>
          )}
        </Field>

        <Field>
          <FieldLabel htmlFor="group-membership-type">{t('new.basics.membershipType')}</FieldLabel>
          <Select
            value={membershipType}
            onValueChange={(v) =>
              form.setValue('membershipType', v as GroupMembershipType, { shouldValidate: true })
            }
          >
            <SelectTrigger
              id="group-membership-type"
              data-testid="groups-new-membership-type-select"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GROUP_MEMBERSHIP_TYPE_VALUES.map((mt) => (
                <SelectItem key={mt} value={mt}>
                  {t(`membershipTypes.${mt}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel>{t('new.basics.memberTypes')}</FieldLabel>
          <FieldDescription>{t('new.basics.memberTypesHelp')}</FieldDescription>
          <div className="flex flex-wrap gap-4 pt-1">
            {MEMBER_TYPES.map((mt) => {
              const checked = memberTypes.includes(mt);
              const id = `member-type-${mt}`;
              return (
                <div key={mt} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    id={id}
                    data-testid={`groups-new-member-type-${mt}`}
                    checked={checked}
                    onCheckedChange={() => toggleMemberType(mt)}
                  />
                  <FieldLabel htmlFor={id} className="cursor-pointer">
                    {t(`memberTypes.${mt}`)}
                  </FieldLabel>
                </div>
              );
            })}
          </div>
          {form.formState.errors.memberTypes && (
            <FieldError>{t('new.basics.errors.memberTypesRequired')}</FieldError>
          )}
        </Field>
      </FieldSet>
    </FieldGroup>
  );
}

// ─── Step 2: Rule Builder ───────────────────────────────────────────────────

function RuleStep({
  rootNode,
  onChange,
}: {
  rootNode: RuleNode;
  onChange: (next: RuleNode) => void;
}) {
  const t = useTranslations('groups');
  const [runPreview, { loading: previewing }] = usePreviewGroupRule();
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [previewData, setPreviewData] = React.useState<{
    count: number;
    sampleMembershipIds: string[];
  } | null>(null);

  const handlePreview = async () => {
    const logic = nodeToJsonLogic(rootNode);
    if (Object.keys(logic).length === 0) {
      toast.error(t('new.rule.previewError'));
      return;
    }
    try {
      const res = await runPreview({ variables: { rule: logic } });
      if (res.data) {
        setPreviewData(res.data.previewGroupRule);
        setPreviewOpen(true);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('new.rule.previewError'));
    }
  };

  return (
    <FieldGroup>
      <FieldSet>
        <FieldLegend>{t('new.rule.sectionTitle')}</FieldLegend>
        <FieldDescription>{t('new.rule.sectionDescription')}</FieldDescription>

        <RuleNodeEditor node={rootNode} onChange={onChange} depth={0} />

        <div className="flex justify-end pt-2">
          <Button type="button" variant="outline" onClick={handlePreview} disabled={previewing}>
            <Zap className="size-4" />
            {previewing ? t('new.rule.previewing') : t('new.rule.preview')}
          </Button>
        </div>
      </FieldSet>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('new.rule.previewDialogTitle')}</DialogTitle>
            <DialogDescription>
              {previewData
                ? t('new.rule.previewCount', { count: previewData.count })
                : t('new.rule.previewEmpty')}
            </DialogDescription>
          </DialogHeader>
          {previewData && previewData.sampleMembershipIds.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                {t('new.rule.previewSample')}
              </p>
              <ul className="max-h-64 space-y-1 overflow-y-auto rounded border bg-muted/30 p-3">
                {previewData.sampleMembershipIds.slice(0, 10).map((mid) => (
                  <li key={mid} className="font-mono text-xs">
                    {mid}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('new.rule.previewEmpty')}</p>
          )}
          <DialogFooter>
            <Button onClick={() => setPreviewOpen(false)}>{t('actions.close')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FieldGroup>
  );
}

function RuleNodeEditor({
  node,
  onChange,
  depth,
}: {
  node: RuleNode;
  onChange: (next: RuleNode) => void;
  depth: number;
}) {
  const t = useTranslations('groups');

  const updateCombinator = (v: Combinator) => onChange({ ...node, combinator: v });

  const updateCondition = (cid: string, patch: Partial<RuleCondition>) =>
    onChange({
      ...node,
      conditions: node.conditions.map((c) => (c.id === cid ? { ...c, ...patch } : c)),
    });

  const removeCondition = (cid: string) =>
    onChange({ ...node, conditions: node.conditions.filter((c) => c.id !== cid) });

  const addCondition = () =>
    onChange({ ...node, conditions: [...node.conditions, emptyCondition()] });

  const addChild = () => onChange({ ...node, children: [...node.children, emptyNode('and')] });

  const updateChild = (cid: string, next: RuleNode) =>
    onChange({
      ...node,
      children: node.children.map((c) => (c.id === cid ? next : c)),
    });

  const removeChild = (cid: string) =>
    onChange({ ...node, children: node.children.filter((c) => c.id !== cid) });

  return (
    <div
      className={`space-y-3 rounded-md border p-3 ${depth === 0 ? 'bg-muted/20' : 'bg-background'}`}
    >
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          {t('new.rule.combinator')}
        </span>
        <Select value={node.combinator} onValueChange={(v) => updateCombinator(v as Combinator)}>
          <SelectTrigger className="h-8 w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="and">{t('combinators.and')}</SelectItem>
            <SelectItem value="or">{t('combinators.or')}</SelectItem>
            <SelectItem value="not">{t('combinators.not')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        {node.conditions.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center gap-2">
            <Select
              value={c.dimension}
              onValueChange={(v) => updateCondition(c.id, { dimension: v })}
            >
              <SelectTrigger className="h-8 w-[180px]" aria-label={t('new.rule.dimension')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DIMENSION_OPTIONS.map((d) => (
                  <SelectItem key={d} value={d}>
                    {t(`dimensions.${d}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={c.operator}
              onValueChange={(v) => updateCondition(c.id, { operator: v as Operator })}
            >
              <SelectTrigger className="h-8 w-[100px]" aria-label={t('new.rule.operator')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPERATOR_OPTIONS.map((op) => (
                  <SelectItem key={op} value={op}>
                    {op}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={c.value}
              onChange={(e) => updateCondition(c.id, { value: e.target.value })}
              placeholder={t('new.rule.valuePlaceholder')}
              className="h-8 w-[200px]"
              aria-label={t('new.rule.value')}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => removeCondition(c.id)}
              aria-label={t('new.rule.removeCondition')}
              title={t('new.rule.removeCondition')}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
      </div>

      {node.children.length > 0 && (
        <div className="space-y-3 border-s-2 ps-3">
          {node.children.map((child) => (
            <div key={child.id} className="space-y-2">
              <RuleNodeEditor
                node={child}
                onChange={(next) => updateChild(child.id, next)}
                depth={depth + 1}
              />
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeChild(child.id)}
                >
                  <Trash2 className="size-4" />
                  {t('new.rule.removeGroup')}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <Button type="button" variant="outline" size="sm" onClick={addCondition}>
          <Plus className="size-4" />
          {t('new.rule.addCondition')}
        </Button>
        {depth < 3 && (
          <Button type="button" variant="outline" size="sm" onClick={addChild}>
            <Plus className="size-4" />
            {t('new.rule.addGroup')}
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Step 3: Members ────────────────────────────────────────────────────────

function MembersStep({
  memberTypes,
  selected,
  onSelectedChange,
}: {
  memberTypes: MemberType[];
  selected: SelectedMember[];
  onSelectedChange: (next: SelectedMember[]) => void;
}) {
  const t = useTranslations('groups');
  const [searchInput, setSearchInput] = React.useState('');
  const debouncedSearch = useDebounce(searchInput, 250);

  const addMember = (m: SelectedMember) => {
    if (selected.some((s) => s.id === m.id && s.memberType === m.memberType)) return;
    onSelectedChange([...selected, m]);
  };

  const removeMember = (id: string, memberType: MemberType) => {
    onSelectedChange(selected.filter((s) => !(s.id === id && s.memberType === memberType)));
  };

  return (
    <FieldGroup>
      <FieldSet>
        <FieldLegend>{t('new.members.sectionTitle')}</FieldLegend>
        <FieldDescription>{t('new.members.sectionDescription')}</FieldDescription>

        <Field>
          <FieldLabel htmlFor="member-search">{t('new.members.search')}</FieldLabel>
          <div className="relative">
            <Search className="absolute start-2.5 top-2 size-4 text-muted-foreground" />
            <Input
              id="member-search"
              data-testid="groups-new-members-search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t('new.members.search')}
              className="ps-8"
            />
          </div>
        </Field>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            {memberTypes.includes('student') && (
              <StudentCandidates search={debouncedSearch} onAdd={addMember} />
            )}
            {memberTypes.includes('staff') && (
              <StaffCandidates search={debouncedSearch} onAdd={addMember} />
            )}
            {memberTypes.includes('guardian') && (
              <GuardianCandidates search={debouncedSearch} onAdd={addMember} />
            )}
          </div>

          <div className="space-y-2 rounded-md border p-3">
            <p className="text-sm font-medium">{t('new.members.selectedMembers')}</p>
            {selected.length === 0 ? (
              <p className="text-sm text-muted-foreground" data-testid="groups-new-no-selection">
                {t('new.members.noSelection')}
              </p>
            ) : (
              <ul className="space-y-1">
                {selected.map((m) => (
                  <li
                    key={`${m.memberType}-${m.id}`}
                    className="flex items-center justify-between gap-2 rounded border bg-background px-2 py-1.5 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        {t(`memberTypes.${m.memberType}`)}
                      </Badge>
                      <span className="truncate">{m.displayName}</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeMember(m.id, m.memberType)}
                      aria-label={t('new.members.removeMember')}
                      title={t('new.members.removeMember')}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </FieldSet>
    </FieldGroup>
  );
}

function StudentCandidates({
  search,
  onAdd,
}: {
  search: string;
  onAdd: (m: SelectedMember) => void;
}) {
  const t = useTranslations('groups');
  const ti = useI18nField();
  const { students, loading } = useStudents({ search: search || undefined, first: 20 });

  return (
    <CandidateList title={t('memberTypes.student')} loading={loading} empty={students.length === 0}>
      {students.map((s) => {
        const first = ti(s.firstName) ?? '';
        const last = ti(s.lastName ?? undefined) ?? '';
        const displayName = `${first} ${last}`.trim() || s.admissionNumber;
        return (
          <CandidateRow
            key={s.id}
            label={`${displayName} · ${s.admissionNumber}`}
            onAdd={() => onAdd({ id: s.id, memberType: 'student', displayName })}
          />
        );
      })}
    </CandidateList>
  );
}

function StaffCandidates({
  search,
  onAdd,
}: {
  search: string;
  onAdd: (m: SelectedMember) => void;
}) {
  const t = useTranslations('groups');
  const ti = useI18nField();
  const { staff, loading } = useStaff({ search: search || undefined, first: 20 });

  return (
    <CandidateList title={t('memberTypes.staff')} loading={loading} empty={staff.length === 0}>
      {staff.map((s) => {
        const first = ti(s.firstName) ?? '';
        const last = ti(s.lastName ?? undefined) ?? '';
        const displayName = `${first} ${last}`.trim() || s.employeeId || s.id;
        return (
          <CandidateRow
            key={s.id}
            label={displayName}
            onAdd={() => onAdd({ id: s.id, memberType: 'staff', displayName })}
          />
        );
      })}
    </CandidateList>
  );
}

function GuardianCandidates({
  search,
  onAdd,
}: {
  search: string;
  onAdd: (m: SelectedMember) => void;
}) {
  const t = useTranslations('groups');
  const ti = useI18nField();
  const { data, loading } = useGuardians({ search: search || undefined });
  const guardians = data?.listGuardians ?? [];

  return (
    <CandidateList
      title={t('memberTypes.guardian')}
      loading={loading}
      empty={guardians.length === 0}
    >
      {guardians.map((g) => {
        const first = ti(g.firstName) ?? '';
        const last = ti(g.lastName ?? undefined) ?? '';
        const displayName = `${first} ${last}`.trim() || g.id;
        return (
          <CandidateRow
            key={g.id}
            label={displayName}
            onAdd={() => onAdd({ id: g.id, memberType: 'guardian', displayName })}
          />
        );
      })}
    </CandidateList>
  );
}

function CandidateList({
  title,
  loading,
  empty,
  children,
}: {
  title: string;
  loading: boolean;
  empty: boolean;
  children: React.ReactNode;
}) {
  const t = useTranslations('groups');
  return (
    <div className="rounded-md border">
      <div className="border-b bg-muted/20 px-3 py-2 text-xs font-medium">{title}</div>
      <ul className="max-h-64 divide-y overflow-y-auto">
        {loading ? (
          <li className="px-3 py-2 text-sm text-muted-foreground">{t('actions.saving')}</li>
        ) : empty ? (
          <li
            className="px-3 py-2 text-sm text-muted-foreground"
            data-testid="groups-new-no-candidates"
          >
            {t('new.members.noCandidates')}
          </li>
        ) : (
          children
        )}
      </ul>
    </div>
  );
}

function CandidateRow({ label, onAdd }: { label: string; onAdd: () => void }) {
  const t = useTranslations('groups');
  return (
    <li className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm">
      <span className="truncate">{label}</span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onAdd}
        aria-label={t('new.members.addMember')}
        title={t('new.members.addMember')}
      >
        <UserPlus className="size-4" />
        {t('new.members.addMember')}
      </Button>
    </li>
  );
}
