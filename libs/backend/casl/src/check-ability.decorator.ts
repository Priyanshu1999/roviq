import { SetMetadata } from '@nestjs/common';
import type { AppAction, AppSubject } from '@roviq/common-types';

export interface AbilityCheck {
  action: AppAction;
  subject: AppSubject;
}

export const CHECK_ABILITY_KEY = 'check_ability';

export const CheckAbility = (action: AppAction, subject: AppSubject) =>
  SetMetadata(CHECK_ABILITY_KEY, { action, subject } satisfies AbilityCheck);
