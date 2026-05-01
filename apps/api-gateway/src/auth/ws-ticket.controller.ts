import { randomUUID } from 'node:crypto';
import { Controller, Get, Inject, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { AuthUser } from '@roviq/common-types';
import { REDIS_CLIENT } from '@roviq/redis';
import type Redis from 'ioredis';
import { REDIS_KEYS } from './redis-keys';

@Controller('auth')
export class WsTicketController {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  @Get('ws-ticket')
  @UseGuards(AuthGuard('jwt'))
  async getWsTicket(@Req() req: { user: AuthUser }): Promise<{ ticket: string }> {
    const ticket = randomUUID();
    const user = req.user;

    await this.redis.set(
      `${REDIS_KEYS.WS_TICKET}${ticket}`,
      JSON.stringify({
        userId: user.userId,
        scope: user.scope,
        tenantId: user.scope === 'institute' ? user.tenantId : null,
        resellerId:
          user.scope === 'reseller'
            ? user.resellerId
            : user.scope === 'institute'
              ? (user.resellerId ?? null)
              : null,
        roleId: user.roleId,
        membershipId: user.membershipId,
      }),
      'EX',
      30, // 30 second TTL
    );

    return { ticket };
  }
}
