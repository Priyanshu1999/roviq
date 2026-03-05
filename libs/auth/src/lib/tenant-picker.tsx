'use client';

import { Button } from '@roviq/ui';
import { useAuth } from './auth-context';
import type { Tenant } from './types';

interface TenantPickerProps {
  tenants: Tenant[];
  onSelect: (tenant: Tenant) => void;
}

export function TenantPicker({ tenants, onSelect }: TenantPickerProps) {
  const { switchTenant } = useAuth();

  if (tenants.length === 0) {
    return (
      <div className="text-muted-foreground text-center text-sm">
        No organizations found for your account.
      </div>
    );
  }

  const handleSelect = (tenant: Tenant) => {
    switchTenant(tenant.id);
    onSelect(tenant);
  };

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Select Organization</h2>
      <p className="text-muted-foreground text-sm">Choose an organization to continue</p>
      <div className="space-y-2">
        {tenants.map((tenant) => (
          <Button
            key={tenant.id}
            type="button"
            variant="outline"
            onClick={() => handleSelect(tenant)}
            className="flex h-auto w-full items-center gap-3 p-3 text-left"
          >
            {tenant.logoUrl ? (
              <img
                src={tenant.logoUrl}
                alt={tenant.name}
                className="h-10 w-10 rounded-md object-cover"
              />
            ) : (
              <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-md text-sm font-bold">
                {tenant.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <div className="font-medium">{tenant.name}</div>
              <div className="text-muted-foreground text-xs">{tenant.slug}</div>
            </div>
          </Button>
        ))}
      </div>
    </div>
  );
}
