import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTenantClient, PrismaClient, PrismaPg } from '@roviq/prisma-client';
import { PRISMA_CLIENT, TENANT_PRISMA_CLIENT } from './prisma.constants';

export { ADMIN_PRISMA_CLIENT, PRISMA_CLIENT, TENANT_PRISMA_CLIENT } from './prisma.constants';

@Module({
  providers: [
    {
      provide: PRISMA_CLIENT,
      useFactory: (config: ConfigService) => {
        const adapter = new PrismaPg({
          connectionString: config.getOrThrow<string>('DATABASE_URL'),
        });
        return new PrismaClient({ adapter });
      },
      inject: [ConfigService],
    },
    {
      provide: TENANT_PRISMA_CLIENT,
      useFactory: (prisma: PrismaClient) => createTenantClient(prisma),
      inject: [PRISMA_CLIENT],
    },
  ],
  exports: [PRISMA_CLIENT, TENANT_PRISMA_CLIENT],
})
export class PrismaModule {}
