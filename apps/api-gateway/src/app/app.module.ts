import { ApolloDriver, type ApolloDriverConfig } from '@nestjs/apollo';
import { Logger, type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { GraphQLModule } from '@nestjs/graphql';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import type { AuthUser } from '@roviq/common-types';
import { EeModule } from '@roviq/ee-gateway';
import { EventBusModule } from '@roviq/event-bus';
import { DateOnlyScalar, DateTimeScalar, I18nTextScalar } from '@roviq/nestjs-graphql';
import { REDIS_CLIENT, RedisModule } from '@roviq/redis';
import { TelemetryModule } from '@roviq/telemetry';
import type Redis from 'ioredis';
import { AdminModule } from '../admin/admin.module';
import { AuditInterceptor } from '../audit/audit.interceptor';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { ImpersonationSessionGuard } from '../auth/middleware/impersonation-session.guard';
import { MustChangePasswordGuard } from '../auth/middleware/must-change-password.guard';
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

const wsLogger = new Logger('WsTicketAuth');

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate }),
    RedisModule,
    NatsJetStreamModule,
    EventBusModule,
    TelemetryModule,
    // Needed by the global `ImpersonationSessionGuard`, which decodes the
    // Bearer token itself (`JwtService.verify`) rather than reading
    // `req.user` — APP_GUARD runs before passport-jwt populates the user.
    JwtModule.register({}),
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 20 }],
    }),
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      inject: [ConfigService, REDIS_CLIENT],
      useFactory: (config: ConfigService, redis: Redis) => ({
        autoSchemaFile: true,
        path: 'api/graphql',
        // Promote domain error `code` from HttpException.getResponse() to
        // extensions.code so GraphQL clients can reliably branch on it.
        // We only look at response.code (our BusinessException shape:
        // { statusCode, code, message }) — never response.error, which
        // NestJS auto-populates with the HTTP status name (e.g. "Forbidden")
        // and would clobber Apollo's canonical codes.
        formatError: (formatted, error) => {
          const err = error as {
            originalError?: {
              response?: { code?: unknown };
              code?: unknown;
            };
          };
          const orig = err.originalError;
          const code =
            (typeof orig?.response === 'object' && orig.response
              ? orig.response.code
              : undefined) ?? orig?.code;
          if (typeof code === 'string' && /^[A-Z][A-Z0-9_]*$/.test(code)) {
            return { ...formatted, extensions: { ...formatted.extensions, code } };
          }
          return formatted;
        },
        playground: config.get('NODE_ENV') !== 'production',
        introspection: config.get('NODE_ENV') !== 'production',
        subscriptions: {
          'graphql-ws': {
            path: '/api/graphql',
            onConnect: async (ctx) => {
              const ticket = ctx.connectionParams?.ticket as string | undefined;
              if (!ticket) {
                wsLogger.warn('WebSocket connection rejected: no ticket provided');
                return false;
              }

              const key = `ws-ticket:${ticket}`;
              const data = await redis.get(key);
              if (!data) {
                wsLogger.warn('WebSocket connection rejected: invalid or expired ticket');
                return false;
              }

              await redis.del(key); // single-use: delete immediately
              const extra = ctx.extra as Record<string, unknown>;
              extra.user = JSON.parse(data) as AuthUser;
              return true;
            },
          },
        },
        context: ({ req, extra }: { req?: { user?: AuthUser }; extra?: { user?: AuthUser } }) => {
          // For WebSocket subscriptions, user is on extra.user (set by onConnect)
          // For HTTP requests, user is on req.user (set by Passport)
          if (extra?.user) {
            return { req: { user: extra.user } };
          }
          return { req };
        },
      }),
    }),
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
    DateOnlyScalar,
    DateTimeScalar,
    I18nTextScalar,
    {
      provide: APP_GUARD,
      useClass: ImpersonationSessionGuard,
    },
    // ROV-96 — first-login enforcement. Runs after JWT auth has populated
    // req.user (or short-circuits when there is no user). Allows handlers
    // marked @AllowWhenPasswordChangeRequired() through; blocks everything
    // else when the access token carries mustChangePassword=true.
    {
      provide: APP_GUARD,
      useClass: MustChangePasswordGuard,
    },
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
