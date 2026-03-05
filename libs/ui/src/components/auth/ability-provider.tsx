'use client';

import { createMongoAbility } from '@casl/ability';
import { createContextualCan } from '@casl/react';
import type { AbilityRule, AppAbility } from '@roviq/common-types';
import * as React from 'react';
import { createContext, useContext } from 'react';

const defaultAbility = createMongoAbility<AppAbility>([]);

export const AbilityContext = createContext<AppAbility>(defaultAbility);

export const Can = createContextualCan(AbilityContext.Consumer);

export function useAbility(): AppAbility {
  return useContext(AbilityContext);
}

interface AbilityProviderProps {
  rules: AbilityRule[];
  children: React.ReactNode;
}

export function AbilityProvider({ rules, children }: AbilityProviderProps) {
  const ability = React.useMemo(() => createMongoAbility<AppAbility>(rules), [rules]);

  return <AbilityContext.Provider value={ability}>{children}</AbilityContext.Provider>;
}
