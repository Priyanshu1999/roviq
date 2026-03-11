import { BadRequestException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { InputJsonValue } from '@prisma/client/runtime/client';
import { ADMIN_PRISMA_CLIENT } from '@roviq/nestjs-prisma';
import type { AdminPrismaClient } from '@roviq/prisma-client';
import { REDIS_CLIENT } from '@roviq/redis';
import type {
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
  RegistrationResponseJSON,
} from '@simplewebauthn/server';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import type Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { AuthService } from '../auth/auth.service';
import type { LoginResult } from '../auth/dto/auth-payload';
import type { PasskeyAuthOptions, PasskeyInfo } from './dto/passkey-info.model';
import type { PasskeyProviderData } from './dto/passkey-provider-data';

const CHALLENGE_TTL = 300; // 5 minutes

function toProviderData(json: unknown): PasskeyProviderData {
  return json as PasskeyProviderData;
}

function toInputJson(data: PasskeyProviderData): InputJsonValue {
  // PasskeyProviderData is fully JSON-serializable (strings, numbers, booleans, string[], null).
  // TypeScript can't structurally verify this against Prisma's recursive InputJsonValue type.
  return data as unknown as InputJsonValue;
}

@Injectable()
export class PasskeyService {
  private readonly rpId: string;
  private readonly rpName: string;
  private readonly origins: string[];

  constructor(
    private readonly config: ConfigService,
    private readonly authService: AuthService,
    @Inject(ADMIN_PRISMA_CLIENT) private readonly adminPrisma: AdminPrismaClient,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {
    this.rpId = this.config.getOrThrow<string>('WEBAUTHN_RP_ID');
    this.rpName = this.config.getOrThrow<string>('WEBAUTHN_RP_NAME');
    this.origins = this.config
      .getOrThrow<string>('ALLOWED_ORIGINS')
      .split(',')
      .map((o) => o.trim());
  }

  async generateRegistrationOptions(
    userId: string,
    password: string,
  ): Promise<Record<string, unknown>> {
    const valid = await this.authService.verifyPassword(userId, password);
    if (!valid) {
      throw new UnauthorizedException('Invalid password');
    }

    const existingPasskeys = await this.adminPrisma.authProvider.findMany({
      where: { userId, provider: 'passkey' },
    });

    const user = await this.adminPrisma.user.findUnique({
      where: { id: userId },
      select: { username: true },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const options = await generateRegistrationOptions({
      rpName: this.rpName,
      rpID: this.rpId,
      userName: user.username,
      attestationType: 'none',
      excludeCredentials: existingPasskeys
        .filter((p) => p.providerUserId !== null)
        .map((p) => {
          const pd = toProviderData(p.providerData);
          return {
            id: p.providerUserId as string,
            transports: pd.transports as AuthenticatorTransportFuture[],
          };
        }),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    });

    await this.redis.set(`webauthn:reg:${userId}`, options.challenge, 'EX', CHALLENGE_TTL);

    return options as unknown as Record<string, unknown>;
  }

  async verifyRegistration(
    userId: string,
    credential: RegistrationResponseJSON,
    name?: string,
  ): Promise<PasskeyInfo> {
    const challenge = await this.redis.get(`webauthn:reg:${userId}`);
    if (!challenge) {
      throw new BadRequestException('Challenge expired or not found');
    }
    await this.redis.del(`webauthn:reg:${userId}`);

    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge: challenge,
      expectedOrigin: this.origins,
      expectedRPID: this.rpId,
    });

    if (!verification.verified || !verification.registrationInfo) {
      throw new BadRequestException('Verification failed');
    }

    const {
      credential: cred,
      credentialDeviceType,
      credentialBackedUp,
      aaguid,
    } = verification.registrationInfo;

    const now = new Date().toISOString();
    const providerData: PasskeyProviderData = {
      publicKey: Buffer.from(cred.publicKey).toString('base64url'),
      counter: cred.counter,
      transports: (cred.transports ?? []) as string[],
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
      webauthnUserID: userId,
      name: name?.trim() || `Passkey ${new Date().toISOString().slice(0, 10)}`,
      registeredAt: now,
      lastUsedAt: null,
      aaguid: aaguid ?? '00000000-0000-0000-0000-000000000000',
    };

    const record = await this.adminPrisma.authProvider.create({
      data: {
        userId,
        provider: 'passkey',
        providerUserId: cred.id,
        providerData: toInputJson(providerData),
      },
    });

    return {
      id: record.id,
      name: providerData.name,
      deviceType: providerData.deviceType,
      backedUp: providerData.backedUp,
      registeredAt: new Date(providerData.registeredAt),
    } as PasskeyInfo;
  }

  async generateAuthOptions(username?: string): Promise<PasskeyAuthOptions> {
    let allowCredentials: { id: string; transports: AuthenticatorTransportFuture[] }[] | undefined;

    if (username) {
      const passkeys = await this.adminPrisma.authProvider.findMany({
        where: {
          provider: 'passkey',
          user: { username, isActive: true },
        },
      });

      if (passkeys.length === 0) {
        throw new UnauthorizedException('Invalid credentials');
      }

      allowCredentials = passkeys
        .filter((p) => p.providerUserId !== null)
        .map((p) => {
          const pd = toProviderData(p.providerData);
          return {
            id: p.providerUserId as string,
            transports: pd.transports as AuthenticatorTransportFuture[],
          };
        });
    }

    const options = await generateAuthenticationOptions({
      rpID: this.rpId,
      allowCredentials,
      userVerification: 'preferred',
    });

    const challengeId = uuidv4();
    await this.redis.set(
      `webauthn:auth:${challengeId}`,
      JSON.stringify({ challenge: options.challenge }),
      'EX',
      CHALLENGE_TTL,
    );

    return {
      optionsJSON: options as unknown as Record<string, unknown>,
      challengeId,
    } as PasskeyAuthOptions;
  }

  async verifyAuth(
    challengeId: string,
    credential: AuthenticationResponseJSON,
  ): Promise<LoginResult> {
    const stored = await this.redis.get(`webauthn:auth:${challengeId}`);
    if (!stored) {
      throw new BadRequestException('Challenge expired or not found');
    }
    await this.redis.del(`webauthn:auth:${challengeId}`);

    const { challenge } = JSON.parse(stored) as { challenge: string };

    const passkey = await this.adminPrisma.authProvider.findFirst({
      where: { provider: 'passkey', providerUserId: credential.id },
    });

    if (!passkey) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const data = toProviderData(passkey.providerData);
    const publicKeyBytes = Buffer.from(data.publicKey, 'base64url');

    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge: challenge,
      expectedOrigin: this.origins,
      expectedRPID: this.rpId,
      credential: {
        id: passkey.providerUserId as string,
        publicKey: new Uint8Array(publicKeyBytes),
        counter: data.counter,
        transports: data.transports as AuthenticatorTransportFuture[],
      },
    });

    if (!verification.verified) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update counter and lastUsedAt
    await this.adminPrisma.authProvider.update({
      where: { id: passkey.id },
      data: {
        providerData: toInputJson({
          ...data,
          counter: verification.authenticationInfo.newCounter,
          lastUsedAt: new Date().toISOString(),
        }),
      },
    });

    return this.authService.loginByUserId(passkey.userId);
  }

  async myPasskeys(userId: string): Promise<PasskeyInfo[]> {
    const passkeys = await this.adminPrisma.authProvider.findMany({
      where: { userId, provider: 'passkey' },
      orderBy: { createdAt: 'desc' },
    });

    return passkeys.map((p) => {
      const data = toProviderData(p.providerData);
      return {
        id: p.id,
        name: data.name,
        deviceType: data.deviceType,
        backedUp: data.backedUp,
        registeredAt: new Date(data.registeredAt),
        lastUsedAt: data.lastUsedAt ? new Date(data.lastUsedAt) : undefined,
      } as PasskeyInfo;
    });
  }

  async removePasskey(userId: string, passkeyId: string): Promise<boolean> {
    const user = await this.adminPrisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    const hasPassword = !!user?.passwordHash;

    const otherPasskeys = await this.adminPrisma.authProvider.count({
      where: { userId, provider: 'passkey', id: { not: passkeyId } },
    });

    if (!hasPassword && otherPasskeys === 0) {
      throw new BadRequestException('Cannot remove your only authentication method');
    }

    const deleted = await this.adminPrisma.authProvider.deleteMany({
      where: { id: passkeyId, userId },
    });

    if (deleted.count === 0) {
      throw new BadRequestException('Passkey not found');
    }

    return true;
  }
}
