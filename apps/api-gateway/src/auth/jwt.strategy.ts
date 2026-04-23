import { Injectable } from '@nestjs/common';
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
    return {
      userId: payload.sub,
      scope: payload.scope,
      tenantId: payload.tenantId,
      resellerId: payload.resellerId,
      membershipId: payload.membershipId,
      roleId: payload.roleId,
      type: 'access',
      mustChangePassword: payload.mustChangePassword ?? false,
      isImpersonated: payload.isImpersonated,
      impersonatorId: payload.impersonatorId,
      impersonationSessionId: payload.impersonationSessionId,
    };
  }
}
