import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { AuthScope, AuthUser } from '@roviq/common-types';
import { ExtractJwt, Strategy } from 'passport-jwt';

interface JwtPayload {
  sub: string;
  scope: AuthScope;
  tenantId?: string;
  resellerId?: string;
  membershipId: string;
  roleId: string;
  type: 'access';
  /** ROV-96 — first-login enforcement claim, mirrored onto AuthUser. */
  mustChangePassword?: boolean;
  // Impersonation
  isImpersonated?: boolean;
  impersonatorId?: string;
  impersonationSessionId?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    const secret = config.getOrThrow<string>('JWT_SECRET');
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  validate(payload: JwtPayload): AuthUser {
    const base = {
      userId: payload.sub,
      membershipId: payload.membershipId,
      roleId: payload.roleId,
      type: 'access' as const,
      mustChangePassword: payload.mustChangePassword ?? false,
      isImpersonated: payload.isImpersonated,
      impersonatorId: payload.impersonatorId,
      impersonationSessionId: payload.impersonationSessionId,
    };
    switch (payload.scope) {
      case 'platform':
        return { ...base, _scope: 'platform', scope: 'platform' };
      case 'reseller':
        if (!payload.resellerId) throw new UnauthorizedException('Reseller JWT missing resellerId');
        return { ...base, _scope: 'reseller', scope: 'reseller', resellerId: payload.resellerId };
      case 'institute':
        if (!payload.tenantId) throw new UnauthorizedException('Institute JWT missing tenantId');
        return {
          ...base,
          _scope: 'institute',
          scope: 'institute',
          tenantId: payload.tenantId,
          resellerId: payload.resellerId,
        };
    }
  }
}
