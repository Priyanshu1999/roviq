'use client';

import { gql, useQuery } from '@roviq/graphql';
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

const LIST_RESELLERS = gql`
  query AdminListResellersForDropdown($search: String) {
    adminListResellers(filter: { search: $search, status: [ACTIVE], first: 50 }) {
      edges {
        node {
          id
          name
          slug
          isSystem
        }
      }
    }
  }
`;

interface ResellerOption {
  id: string;
  name: string;
  slug: string;
  isSystem: boolean;
}

interface Data {
  adminListResellers: {
    edges: Array<{ node: ResellerOption }>;
  };
}

export interface ResellerComboboxProps {
  value?: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  /** If true (default), the user cannot clear the selection. */
  required?: boolean;
  disabled?: boolean;
  'data-testid'?: string;
}

/**
 * Searchable combobox for picking a reseller. Default "Roviq Direct" (isSystem=true)
 * is preselected when the caller hasn't set a value.
 */
export function ResellerCombobox({
  value,
  onChange,
  placeholder,
  required = false,
  disabled,
  'data-testid': testId,
}: ResellerComboboxProps) {
  const t = useTranslations('adminInstitutes.combobox');
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');

  const { data, loading } = useQuery<Data>(LIST_RESELLERS, {
    variables: { search: search || null },
    fetchPolicy: 'cache-and-network',
  });

  const options = data?.adminListResellers.edges.map((e) => e.node) ?? [];
  const selected = options.find((o) => o.id === value);

  // Default to Roviq Direct on first load if no value set
  React.useEffect(() => {
    if (!value && options.length > 0) {
      const system = options.find((o) => o.isSystem);
      if (system) onChange(system.id);
    }
  }, [value, options, onChange]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={placeholder ?? t('reseller')}
          disabled={disabled}
          className="w-full justify-between font-normal"
          data-testid={testId ?? 'reseller-combobox-trigger'}
        >
          <span className={selected ? '' : 'text-muted-foreground'}>
            {selected?.name ?? placeholder ?? t('resellerPlaceholder')}
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
          <CommandInput
            placeholder={t('searchReseller')}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>{loading ? t('loading') : t('noResults')}</CommandEmpty>
            <CommandGroup>
              {!required && (
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
                  <span className="text-muted-foreground">{t('none')}</span>
                </CommandItem>
              )}
              {options.map((option) => (
                <CommandItem
                  key={option.id}
                  value={option.id}
                  onSelect={() => {
                    onChange(option.id);
                    setOpen(false);
                  }}
                  data-testid={`reseller-option-${option.slug}`}
                >
                  <Check
                    className={`mr-2 size-4 ${value === option.id ? 'opacity-100' : 'opacity-0'}`}
                    aria-hidden="true"
                  />
                  <span>{option.name}</span>
                  {option.isSystem && (
                    <span className="ms-2 text-xs text-muted-foreground">{t('systemLabel')}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
