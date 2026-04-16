'use client';

import { gql, useQuery } from '@roviq/graphql';
import { useI18nField } from '@roviq/i18n';
import {
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@roviq/ui';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

const LIST_GROUPS = gql`
  query AdminListInstituteGroupsForDropdown($search: String) {
    adminListInstituteGroups(filter: { search: $search, first: 50 }) {
      edges {
        node {
          id
          name
        }
      }
    }
  }
`;

interface GroupOption {
  id: string;
  name: Record<string, string>;
}

interface Data {
  adminListInstituteGroups: {
    edges: Array<{ node: GroupOption }>;
  };
}

export interface InstituteGroupComboboxProps {
  value?: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  'data-testid'?: string;
}

/**
 * Searchable combobox for picking an institute group (franchise / trust).
 * Group is optional — the "No group" item clears the selection.
 */
export function InstituteGroupCombobox({
  value,
  onChange,
  placeholder,
  disabled,
  'data-testid': testId,
}: InstituteGroupComboboxProps) {
  const t = useTranslations('adminInstitutes.combobox');
  const resolveI18n = useI18nField();
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');

  const { data, loading } = useQuery<Data>(LIST_GROUPS, {
    variables: { search: search || null },
    fetchPolicy: 'cache-and-network',
  });

  const options = data?.adminListInstituteGroups.edges.map((e) => e.node) ?? [];
  const selected = options.find((o) => o.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={placeholder ?? t('group')}
          disabled={disabled}
          className="w-full justify-between font-normal"
          data-testid={testId ?? 'institute-group-combobox-trigger'}
        >
          <span className={selected ? '' : 'text-muted-foreground'}>
            {selected ? resolveI18n(selected.name) : (placeholder ?? t('groupPlaceholder'))}
          </span>
          {loading ? (
            <Loader2 className="size-4 animate-spin opacity-50" />
          ) : (
            <ChevronsUpDown className="size-4 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command shouldFilter={false}>
          <CommandInput placeholder={t('searchGroup')} value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>{loading ? t('loading') : t('noResults')}</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__clear__"
                onSelect={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                <Check
                  className={`mr-2 size-4 ${value ? 'opacity-0' : 'opacity-100'}`}
                  aria-hidden="true"
                />
                <span className="text-muted-foreground">{t('noGroup')}</span>
              </CommandItem>
              {options.map((option) => (
                <CommandItem
                  key={option.id}
                  value={option.id}
                  onSelect={() => {
                    onChange(option.id);
                    setOpen(false);
                  }}
                  data-testid={`group-option-${option.id}`}
                >
                  <Check
                    className={`mr-2 size-4 ${value === option.id ? 'opacity-100' : 'opacity-0'}`}
                    aria-hidden="true"
                  />
                  <span>{resolveI18n(option.name)}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
