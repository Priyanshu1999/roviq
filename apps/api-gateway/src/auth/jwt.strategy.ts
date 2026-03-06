import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

interface JwtPayload {
  sub: string;
  tenantId?: string;
  roleId?: string;
  type: 'access' | 'platform';
}

export interface AuthUser {
  userId: string;
  tenantId: string;
  roleId: string;
  type: 'access' | 'platform';
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
    if (payload.type === 'platform') {
      return {
        userId: payload.sub,
        tenantId: '',
        roleId: '',
        type: 'platform',
      };
    }
    return {
      userId: payload.sub,
      tenantId: payload.tenantId ?? '',
      roleId: payload.roleId ?? '',
      type: 'access',
    };
  }
}
