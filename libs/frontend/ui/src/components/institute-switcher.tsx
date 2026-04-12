'use client';

import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

interface Institute {
  membershipId: string;
  name: string;
  slug: string;
  logoUrl?: string;
  roleName: string;
  isCurrent: boolean;
}

interface InstituteSwitcherProps {
  institutes: Institute[];
  onSwitch: (membershipId: string) => Promise<void>;
}

export function InstituteSwitcher({ institutes, onSwitch }: InstituteSwitcherProps) {
  const [switching, setSwitching] = useState(false);
  const current = institutes.find((i) => i.isCurrent);

  if (institutes.length <= 1) return null;

  const handleSwitch = async (membershipId: string) => {
    setSwitching(true);
    try {
      await onSwitch(membershipId);
    } finally {
      setSwitching(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" disabled={switching} data-test-id="institute-switcher">
          {current?.name ?? 'Switch Institute'}
          <ChevronDown className="ml-1 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" data-test-id="institute-switcher-menu">
        {institutes
          .filter((i) => !i.isCurrent)
          .map((inst) => (
            <DropdownMenuItem
              key={inst.membershipId}
              onClick={() => handleSwitch(inst.membershipId)}
            >
              {inst.name} — {inst.roleName}
            </DropdownMenuItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
