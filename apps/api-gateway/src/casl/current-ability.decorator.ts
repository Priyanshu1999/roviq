import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { AppAbility } from '@roviq/common-types';

export const CurrentAbility = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AppAbility | undefined => {
    const ctx = GqlExecutionContext.create(context);
    return ctx.getContext().req.ability;
  },
);
