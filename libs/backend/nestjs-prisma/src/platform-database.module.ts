import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createAdminClient, PrismaClient, PrismaPg } from '@roviq/prisma-client';
import { ADMIN_PRISMA_CLIENT } from './prisma.constants';

@Module({
  providers: [
    {
      provide: ADMIN_PRISMA_CLIENT,
      useFactory: (config: ConfigService) => {
        const adapter = new PrismaPg({
          connectionString: config.getOrThrow<string>('DATABASE_URL_ADMIN'),
        });
        return createAdminClient(new PrismaClient({ adapter }));
      },
      inject: [ConfigService],
    },
  ],
  exports: [ADMIN_PRISMA_CLIENT],
})
export class PlatformDatabaseModule {}
