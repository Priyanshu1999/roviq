import { applyDecorators, UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from '../guards/gql-auth.guard';
import { InstituteScopeGuard } from '../guards/institute-scope.guard';
import { PlatformScopeGuard } from '../guards/platform-scope.guard';
import { ResellerScopeGuard } from '../guards/reseller-scope.guard';

/** Apply to resolver class — requires authenticated platform-scope token */
export const PlatformScope = () => applyDecorators(UseGuards(GqlAuthGuard, PlatformScopeGuard));

/** Apply to resolver class — requires authenticated reseller-scope token */
export const ResellerScope = () => applyDecorators(UseGuards(GqlAuthGuard, ResellerScopeGuard));

/** Apply to resolver class — requires authenticated institute-scope token */
export const InstituteScope = () => applyDecorators(UseGuards(GqlAuthGuard, InstituteScopeGuard));
