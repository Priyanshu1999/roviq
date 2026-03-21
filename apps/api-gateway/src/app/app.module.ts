import { ApolloDriver, type ApolloDriverConfig } from '@nestjs/apollo';
import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { GraphQLModule } from '@nestjs/graphql';
import { ThrottlerModule } from '@nestjs/throttler';
import { EeModule } from '@roviq/ee-gateway';
import { I18nTextScalar } from '@roviq/nestjs-graphql';
import { RedisModule } from '@roviq/redis';
import { TelemetryModule } from '@roviq/telemetry';
import { AdminModule } from '../admin/admin.module';
import { AuditInterceptor } from '../audit/audit.interceptor';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { TenantMiddleware } from '../auth/middleware/tenant.middleware';
import { CaslModule } from '../casl/casl.module';
import { CorrelationIdMiddleware } from '../common/middleware/correlation-id.middleware';
import { validate } from '../config/env.validation';
import { HealthModule } from '../health/health.module';
import { InstituteScopeModule } from '../institute/institute-scope.module';
import { NatsJetStreamModule } from '../nats/nats-jetstream.module';
import { NovuProxyModule } from '../novu-proxy/novu-proxy.module';
import { PasskeyModule } from '../passkey/passkey.module';
import { ResellerModule } from '../reseller/reseller.module';
import { AppController } from './app.controller';
import { AppResolver } from './app.resolver';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate }),
    NatsJetStreamModule,
    TelemetryModule,
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 20 }],
    }),
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        autoSchemaFile: true,
        path: 'api/graphql',
        playground: config.get('NODE_ENV') !== 'production',
        introspection: config.get('NODE_ENV') !== 'production',
        context: ({ req }: { req: unknown }) => ({ req }),
      }),
    }),
    RedisModule,
    AuthModule,
    CaslModule,
    HealthModule,
    AuditModule,
    PasskeyModule,
    AdminModule,
    ResellerModule,
    InstituteScopeModule,
    NovuProxyModule,
    EeModule.register(),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    AppResolver,
    I18nTextScalar,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*path');
    consumer.apply(TenantMiddleware).forRoutes('*path');
  }
}
