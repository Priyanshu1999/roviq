import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { AuthUser } from '../auth/jwt.strategy';
import { AbilityFactory } from './ability.factory';
import { type AbilityCheck, CHECK_ABILITY_KEY } from './check-ability.decorator';

@Injectable()
export class AbilityGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly abilityFactory: AbilityFactory,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const check = this.reflector.get<AbilityCheck | undefined>(
      CHECK_ABILITY_KEY,
      context.getHandler(),
    );

    if (!check) {
      return true; // No ability check required
    }

    const ctx = GqlExecutionContext.create(context);
    const user = ctx.getContext().req.user as AuthUser | undefined;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    const ability = await this.abilityFactory.createForUser(user);

    if (!ability.can(check.action, check.subject)) {
      throw new ForbiddenException(`You are not allowed to ${check.action} ${check.subject}`);
    }

    // Attach ability to request for use in resolvers
    ctx.getContext().req.ability = ability;

    return true;
  }
}
