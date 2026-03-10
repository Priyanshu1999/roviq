# OpenTelemetry + Grafana Observability Stack Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add full observability (traces, logs, metrics) to all NestJS services with the Grafana LGTM stack.

**Architecture:** OTel SDK initializes before NestJS bootstrap, auto-instruments HTTP/GraphQL/Prisma, ships telemetry via OTLP gRPC to an OTel Collector which routes traces→Tempo, logs→Loki, metrics→Prometheus. Grafana dashboards are auto-provisioned. Health endpoints use @nestjs/terminus.

**Tech Stack:** @opentelemetry/sdk-node, nestjs-pino, @opentelemetry/instrumentation-pino, @nestjs/terminus, Grafana, Tempo, Loki, Prometheus, OTel Collector

**Design doc:** `docs/plans/2026-03-10-opentelemetry-grafana-observability-design.md`

**Linear issue:** ROV-24

---

## Task 1: Install Dependencies

**Files:**
- Modify: `package.json` (root)

**Step 1: Install production dependencies**

Run:
```bash
pnpm add @opentelemetry/api @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node @opentelemetry/exporter-trace-otlp-grpc @opentelemetry/sdk-trace-base @opentelemetry/instrumentation-pino @opentelemetry/resources @opentelemetry/semantic-conventions nestjs-pino pino-http nestjs-otel @nestjs/terminus
```

**Step 2: Install dev dependencies**

Run:
```bash
pnpm add -D pino-pretty
```

**Step 3: Verify installation**

Run: `pnpm ls @opentelemetry/sdk-node nestjs-pino @nestjs/terminus`
Expected: All three packages listed with versions

**Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore(deps): add opentelemetry, nestjs-pino, and terminus packages"
```

---

## Task 2: Docker Infrastructure Config Files

**Files:**
- Create: `docker/otel/collector-config.yaml`
- Create: `docker/prometheus/prometheus.yaml`
- Create: `docker/tempo/tempo-config.yaml`
- Create: `docker/loki/loki-config.yaml`
- Create: `docker/grafana/provisioning/datasources/datasources.yaml`
- Create: `docker/grafana/provisioning/dashboards/dashboard.yaml`

**Step 1: Create OTel Collector config**

Create `docker/otel/collector-config.yaml`:

```yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

processors:
  batch:
    timeout: 5s
    send_batch_size: 512
  memory_limiter:
    check_interval: 1s
    limit_mib: 512

exporters:
  otlp/tempo:
    endpoint: tempo:4317
    tls:
      insecure: true
  otlphttp/loki:
    endpoint: http://loki:3100/otlp
    tls:
      insecure: true
  prometheus:
    endpoint: 0.0.0.0:8889
    namespace: roviq

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [otlp/tempo]
    logs:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [otlphttp/loki]
    metrics:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [prometheus]
```

**Step 2: Create Prometheus config**

Create `docker/prometheus/prometheus.yaml`:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'otel-collector'
    static_configs:
      - targets: ['otel-collector:8889']
```

**Step 3: Create Tempo config**

Create `docker/tempo/tempo-config.yaml`:

```yaml
server:
  http_listen_port: 3200

distributor:
  receivers:
    otlp:
      protocols:
        grpc:
          endpoint: 0.0.0.0:4317

storage:
  trace:
    backend: local
    local:
      path: /var/tempo/blocks
    wal:
      path: /var/tempo/wal

metrics_generator:
  storage:
    path: /var/tempo/metrics
  traces_storage:
    path: /var/tempo/blocks
```

**Step 4: Create Loki config**

Create `docker/loki/loki-config.yaml`:

```yaml
auth_enabled: false

server:
  http_listen_port: 3100

common:
  path_prefix: /loki
  storage:
    filesystem:
      chunks_directory: /loki/chunks
      rules_directory: /loki/rules
  replication_factor: 1
  ring:
    kvstore:
      store: inmemory

limits_config:
  allow_structured_metadata: true

schema_config:
  configs:
    - from: '2024-01-01'
      store: tsdb
      object_store: filesystem
      schema: v13
      index:
        prefix: index_
        period: 24h
```

**Step 5: Create Grafana datasources provisioning**

Create `docker/grafana/provisioning/datasources/datasources.yaml`:

```yaml
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: false

  - name: Tempo
    type: tempo
    access: proxy
    url: http://tempo:3200
    editable: false
    jsonData:
      tracesToLogsV2:
        datasourceUid: loki
        filterByTraceID: true
      nodeGraph:
        enabled: true

  - name: Loki
    type: loki
    access: proxy
    url: http://loki:3100
    editable: false
    jsonData:
      derivedFields:
        - datasourceUid: tempo
          matcherRegex: '"trace_id":"(\w+)"'
          name: TraceID
          url: '$${__value.raw}'
```

**Step 6: Create Grafana dashboard provisioning config**

Create `docker/grafana/provisioning/dashboards/dashboard.yaml`:

```yaml
apiVersion: 1

providers:
  - name: 'default'
    orgId: 1
    folder: 'Roviq'
    type: file
    disableDeletion: false
    editable: true
    options:
      path: /var/lib/grafana/dashboards
      foldersFromFilesStructure: false
```

**Step 7: Commit**

```bash
git add docker/otel/ docker/prometheus/ docker/tempo/ docker/loki/ docker/grafana/
git commit -m "chore(infra): add otel-collector, prometheus, tempo, loki, grafana configs"
```

---

## Task 3: Update Docker Compose

**Files:**
- Modify: `docker/compose.infra.yaml`

**Step 1: Add observability services to compose.infra.yaml**

Append the following services before the `volumes:` section:

```yaml
  otel-collector:
    image: otel/opentelemetry-collector-contrib:latest
    command: ['--config', '/etc/otelcol/config.yaml']
    volumes:
      - ./otel/collector-config.yaml:/etc/otelcol/config.yaml:ro
    ports:
      - '4317:4317'
      - '4318:4318'
    depends_on:
      tempo:
        condition: service_started
      loki:
        condition: service_started
    healthcheck:
      test: ['CMD', 'wget', '--spider', 'http://localhost:13133']
      interval: 5s
      timeout: 3s
      retries: 5

  tempo:
    image: grafana/tempo:latest
    command: ['-config.file=/etc/tempo/config.yaml']
    volumes:
      - ./tempo/tempo-config.yaml:/etc/tempo/config.yaml:ro
      - tempo_data:/var/tempo
    ports:
      - '3200:3200'
    healthcheck:
      test: ['CMD', 'wget', '--spider', 'http://localhost:3200/ready']
      interval: 5s
      timeout: 3s
      retries: 5

  loki:
    image: grafana/loki:latest
    command: ['-config.file=/etc/loki/config.yaml']
    volumes:
      - ./loki/loki-config.yaml:/etc/loki/config.yaml:ro
      - loki_data:/loki
    ports:
      - '3100:3100'
    healthcheck:
      test: ['CMD', 'wget', '--spider', 'http://localhost:3100/ready']
      interval: 5s
      timeout: 3s
      retries: 5

  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./prometheus/prometheus.yaml:/etc/prometheus/prometheus.yml:ro
      - prometheus_data:/prometheus
    ports:
      - '9090:9090'
    healthcheck:
      test: ['CMD', 'wget', '--spider', 'http://localhost:9090/-/ready']
      interval: 5s
      timeout: 3s
      retries: 5

  grafana:
    image: grafana/grafana:latest
    environment:
      GF_SECURITY_ADMIN_USER: admin
      GF_SECURITY_ADMIN_PASSWORD: admin
      GF_AUTH_ANONYMOUS_ENABLED: 'true'
      GF_AUTH_ANONYMOUS_ORG_ROLE: Admin
    volumes:
      - ./grafana/provisioning:/etc/grafana/provisioning:ro
      - ./grafana/dashboards:/var/lib/grafana/dashboards:ro
      - grafana_data:/var/lib/grafana
    ports:
      - '3001:3000'
    depends_on:
      prometheus:
        condition: service_started
      tempo:
        condition: service_started
      loki:
        condition: service_started
```

Also add to the `volumes:` section:

```yaml
  tempo_data:
  loki_data:
  prometheus_data:
  grafana_data:
```

**Step 2: Verify compose file is valid**

Run: `docker compose -f docker/compose.infra.yaml config --quiet`
Expected: No errors

**Step 3: Commit**

```bash
git add docker/compose.infra.yaml
git commit -m "chore(infra): add observability services to docker compose"
```

---

## Task 4: Update Tiltfile

**Files:**
- Modify: `Tiltfile`

**Step 1: Add observability resource labels and Grafana link**

After the existing `dc_resource('temporal-ui', ...)` line, add:

```python
# Observability (Grafana, Prometheus, Loki, Tempo, OTel Collector)
dc_resource('otel-collector', labels=['observability'], resource_deps=['tempo', 'loki'])
dc_resource('prometheus', labels=['observability'])
dc_resource('tempo', labels=['observability'])
dc_resource('loki', labels=['observability'])
dc_resource('grafana', labels=['observability'], resource_deps=['prometheus', 'tempo', 'loki'],
            links=['http://localhost:3001'])
```

Update the `api-gateway` resource_deps to include `otel-collector`:

Change:
```python
  resource_deps=['db-seed', 'redis', 'nats'],
```
To:
```python
  resource_deps=['db-seed', 'redis', 'nats', 'otel-collector'],
```

**Step 2: Verify Tiltfile syntax**

Run: `python3 -c "exec(open('Tiltfile').read())" 2>&1 || echo "Syntax check (best-effort)"`

Note: Tiltfile uses Starlark, not pure Python. Full validation requires `tilt up`. The syntax check above is best-effort.

**Step 3: Commit**

```bash
git add Tiltfile
git commit -m "chore(infra): add observability resources to Tiltfile"
```

---

## Task 5: Create `@roviq/telemetry` Library — Scaffold

**Files:**
- Create: `libs/backend/telemetry/src/index.ts`
- Create: `libs/backend/telemetry/src/init-telemetry.ts`
- Create: `libs/backend/telemetry/package.json`
- Create: `libs/backend/telemetry/project.json`
- Create: `libs/backend/telemetry/tsconfig.json`
- Create: `libs/backend/telemetry/tsconfig.lib.json`
- Modify: `tsconfig.base.json` (add path alias)

**Step 1: Create project.json**

Create `libs/backend/telemetry/project.json`:

```json
{
  "name": "telemetry",
  "$schema": "../../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "libs/backend/telemetry/src",
  "projectType": "library",
  "targets": {
    "build": {
      "executor": "@nx/js:tsc",
      "outputs": ["{options.outputPath}"],
      "options": {
        "outputPath": "dist/libs/telemetry",
        "main": "libs/backend/telemetry/src/index.ts",
        "tsConfig": "libs/backend/telemetry/tsconfig.lib.json",
        "assets": ["libs/backend/telemetry/*.md"]
      }
    }
  },
  "tags": []
}
```

**Step 2: Create package.json**

Create `libs/backend/telemetry/package.json`:

```json
{
  "name": "@roviq/telemetry",
  "version": "0.0.1",
  "private": true,
  "type": "commonjs",
  "main": "./src/index.js",
  "types": "./src/index.d.ts",
  "dependencies": {
    "tslib": "^2.3.0"
  }
}
```

**Step 3: Create tsconfig.json**

Create `libs/backend/telemetry/tsconfig.json`:

```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "module": "node16",
    "moduleResolution": "node16",
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "importHelpers": true,
    "noImplicitOverride": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noPropertyAccessFromIndexSignature": true
  },
  "files": [],
  "include": [],
  "references": [
    {
      "path": "./tsconfig.lib.json"
    }
  ]
}
```

**Step 4: Create tsconfig.lib.json**

Create `libs/backend/telemetry/tsconfig.lib.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "../../../dist/out-tsc",
    "declaration": true,
    "types": []
  },
  "include": ["src/**/*.ts"]
}
```

**Step 5: Add path alias to tsconfig.base.json**

Add to the `paths` object in `tsconfig.base.json`:

```json
"@roviq/telemetry": ["libs/backend/telemetry/src/index.ts"]
```

**Step 6: Commit scaffold**

```bash
git add libs/backend/telemetry/ tsconfig.base.json
git commit -m "chore: scaffold @roviq/telemetry library"
```

---

## Task 6: Create `@roviq/telemetry` — OTel SDK Init

**Files:**
- Create: `libs/backend/telemetry/src/init-telemetry.ts`
- Create: `libs/backend/telemetry/src/index.ts`

**Step 1: Create init-telemetry.ts**

Create `libs/backend/telemetry/src/init-telemetry.ts`:

```typescript
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { PinoInstrumentation } from '@opentelemetry/instrumentation-pino';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import {
  BatchSpanProcessor,
  ParentBasedSampler,
  TraceIdRatioBasedSampler,
} from '@opentelemetry/sdk-trace-base';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

const isProduction = process.env.NODE_ENV === 'production';

const sdk = new NodeSDK({
  sampler: new ParentBasedSampler({
    root: new TraceIdRatioBasedSampler(isProduction ? 0.1 : 1.0),
  }),
  spanProcessors: [
    new BatchSpanProcessor(
      new OTLPTraceExporter({
        url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4317',
      }),
      {
        maxExportBatchSize: isProduction ? 200 : 50,
        scheduledDelayMillis: isProduction ? 2000 : 1000,
      },
    ),
  ],
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'unknown-service',
    [ATTR_SERVICE_VERSION]: process.env.OTEL_SERVICE_VERSION || '0.0.0',
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },
      '@opentelemetry/instrumentation-dns': { enabled: false },
      '@opentelemetry/instrumentation-net': { enabled: false },
      '@opentelemetry/instrumentation-http': {
        ignoreIncomingRequestHook: (req) => {
          const ignore = ['/health', '/metrics', '/favicon.ico'];
          return ignore.some((p) => req.url?.startsWith(p)) || false;
        },
      },
    }),
    new PinoInstrumentation(),
  ],
});

sdk.start();

process.on('SIGTERM', () => {
  sdk.shutdown().finally(() => process.exit(0));
});
```

**Step 2: Create index.ts**

Create `libs/backend/telemetry/src/index.ts`:

```typescript
export { TelemetryModule } from './telemetry.module.js';
```

Note: `init-telemetry.ts` is NOT exported from index — it's imported directly via `@roviq/telemetry/src/init-telemetry` as a side-effect import in each app's `main.ts`.

**Step 3: Verify it compiles**

Run: `pnpm run typecheck`
Expected: No errors related to telemetry lib

**Step 4: Commit**

```bash
git add libs/backend/telemetry/src/
git commit -m "feat(telemetry): add OpenTelemetry SDK initialization with auto-instrumentation"
```

---

## Task 7: Create `@roviq/telemetry` — NestJS Logger Module

**Files:**
- Create: `libs/backend/telemetry/src/telemetry.module.ts`

**Step 1: Create telemetry.module.ts**

Create `libs/backend/telemetry/src/telemetry.module.ts`:

```typescript
import { type MiddlewareConsumer, Module, type NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import crypto from 'node:crypto';

@Module({
  imports: [
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level: config.get<string>('LOG_LEVEL', 'info'),
          transport:
            config.get<string>('NODE_ENV') !== 'production'
              ? { target: 'pino-pretty', options: { colorize: true } }
              : undefined,
          genReqId: (req: { headers: Record<string, string | undefined> }) =>
            req.headers['x-request-id'] || crypto.randomUUID(),
        },
        exclude: [{ method: RequestMethod.ALL, path: 'health' }],
      }),
    }),
  ],
  exports: [LoggerModule],
})
export class TelemetryModule {}
```

**Step 2: Verify it compiles**

Run: `pnpm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add libs/backend/telemetry/src/telemetry.module.ts
git commit -m "feat(telemetry): add TelemetryModule with nestjs-pino structured logging"
```

---

## Task 8: Create Health Module

**Files:**
- Create: `apps/api-gateway/src/health/health.module.ts`
- Create: `apps/api-gateway/src/health/health.controller.ts`
- Create: `apps/api-gateway/src/health/indicators/redis.health.ts`
- Create: `apps/api-gateway/src/health/__tests__/health.controller.spec.ts`

**Step 1: Write the failing health controller test**

Create `apps/api-gateway/src/health/__tests__/health.controller.spec.ts`:

```typescript
import { type TestingModule, Test } from '@nestjs/testing';
import { HealthCheckService, HealthIndicatorService } from '@nestjs/terminus';
import { HealthController } from '../health.controller';
import { RedisHealthIndicator } from '../indicators/redis.health';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthCheckService,
          useValue: {
            check: vi.fn().mockResolvedValue({
              status: 'ok',
              info: {
                db: { status: 'up' },
                redis: { status: 'up' },
              },
            }),
          },
        },
        {
          provide: HealthIndicatorService,
          useValue: { check: vi.fn() },
        },
        {
          provide: RedisHealthIndicator,
          useValue: { isHealthy: vi.fn().mockResolvedValue({ redis: { status: 'up' } }) },
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return health status', async () => {
    const result = await controller.check();
    expect(result.status).toBe('ok');
  });
});
```

**Step 2: Run the test to verify it fails**

Run: `pnpm exec nx test api-gateway -- --testPathPattern=health.controller`
Expected: FAIL — HealthController module not found

**Step 3: Create RedisHealthIndicator**

Create `apps/api-gateway/src/health/indicators/redis.health.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import Redis from 'ioredis';

@Injectable()
export class RedisHealthIndicator {
  private readonly indicator;

  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {
    this.indicator = this.healthIndicatorService.check('redis');
  }

  async isHealthy(): Promise<Record<string, { status: string }>> {
    try {
      const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
        connectTimeout: 2000,
        lazyConnect: true,
      });
      await redis.connect();
      await redis.ping();
      await redis.quit();
      return this.indicator.up();
    } catch {
      return this.indicator.down();
    }
  }
}
```

**Step 4: Create HealthController**

Create `apps/api-gateway/src/health/health.controller.ts`:

```typescript
import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { RedisHealthIndicator } from './indicators/redis.health';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly redis: RedisHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.redis.isHealthy(),
    ]);
  }
}
```

Note: We intentionally omit `PrismaHealthIndicator` and `MicroserviceHealthIndicator` from the initial implementation. Prisma health requires injecting the Prisma client (which uses tenant extensions), and NATS health requires a `MicroserviceHealthIndicator` transport config that depends on how the NATS connection is managed. These can be added in a follow-up once the base health module works. The Redis indicator demonstrates the pattern.

**Step 5: Create HealthModule**

Create `apps/api-gateway/src/health/health.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { RedisHealthIndicator } from './indicators/redis.health';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [RedisHealthIndicator],
})
export class HealthModule {}
```

**Step 6: Run the test to verify it passes**

Run: `pnpm exec nx test api-gateway -- --testPathPattern=health.controller`
Expected: PASS

**Step 7: Commit**

```bash
git add apps/api-gateway/src/health/
git commit -m "feat(health): add health check endpoint with Redis indicator"
```

---

## Task 9: Integrate Telemetry + Health into API Gateway

**Files:**
- Modify: `apps/api-gateway/src/main.ts`
- Modify: `apps/api-gateway/src/app/app.module.ts`

**Step 1: Update main.ts — add OTel init as first import and Pino logger**

Replace the entire `apps/api-gateway/src/main.ts` with:

```typescript
// MUST be first import — initializes OpenTelemetry before NestJS
import '../../../libs/backend/telemetry/src/init-telemetry';

import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const config = app.get(ConfigService);
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);

  app.use(helmet());

  app.enableCors({
    origin: config.get<string>('CORS_ORIGINS')?.split(',') ?? [
      'http://localhost:4200',
      'http://localhost:4300',
    ],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = config.get<number>('API_GATEWAY_PORT', 3000);
  await app.listen(port);

  const logger = app.get(Logger);
  logger.log(`Application is running on: http://localhost:${port}/${globalPrefix}`);
}

bootstrap();
```

**Step 2: Update app.module.ts — add TelemetryModule and HealthModule**

Add imports for `TelemetryModule` and `HealthModule`:

```typescript
import { TelemetryModule } from '@roviq/telemetry';
import { HealthModule } from '../health/health.module';
```

Add both to the `imports` array in `@Module`:

```typescript
imports: [
  ConfigModule.forRoot({ isGlobal: true }),
  TelemetryModule,
  // ... existing modules
  HealthModule,
],
```

**Step 3: Verify it compiles**

Run: `pnpm run typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add apps/api-gateway/src/main.ts apps/api-gateway/src/app/app.module.ts
git commit -m "feat(gateway): integrate telemetry and health modules"
```

---

## Task 10: Add Tenant Context to Logs

**Files:**
- Modify: `apps/api-gateway/src/auth/middleware/tenant.middleware.ts`

**Step 1: Update TenantMiddleware to assign tenantId to Pino logs**

Modify `apps/api-gateway/src/auth/middleware/tenant.middleware.ts`:

```typescript
import { Injectable, type NestMiddleware } from '@nestjs/common';
import { tenantContext } from '@roviq/prisma-client';
import type { NextFunction, Request, Response } from 'express';
import { PinoLogger } from 'nestjs-pino';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly logger: PinoLogger) {}

  use(req: Request, _res: Response, next: NextFunction) {
    const user = (req as Request & { user?: { tenantId?: string } }).user;
    const tenantId = user?.tenantId;

    if (tenantId) {
      this.logger.assign({ tenantId });
      tenantContext.run({ tenantId }, () => next());
    } else {
      next();
    }
  }
}
```

**Step 2: Verify it compiles**

Run: `pnpm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/api-gateway/src/auth/middleware/tenant.middleware.ts
git commit -m "feat(telemetry): enrich logs with tenantId from request context"
```

---

## Task 11: Environment Variables

**Files:**
- Modify: `.env.example`

**Step 1: Add observability env vars to .env.example**

Append to `.env.example`:

```env

# OpenTelemetry — observability
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
OTEL_SERVICE_NAME=api-gateway
OTEL_SERVICE_VERSION=0.0.0
LOG_LEVEL=info
```

**Step 2: Add the same vars to the actual .env file**

Run:
```bash
echo '' >> .env
echo '# OpenTelemetry — observability' >> .env
echo 'OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317' >> .env
echo 'OTEL_SERVICE_NAME=api-gateway' >> .env
echo 'OTEL_SERVICE_VERSION=0.0.0' >> .env
echo 'LOG_LEVEL=info' >> .env
```

**Step 3: Commit**

```bash
git add .env.example
git commit -m "chore: add observability environment variables to .env.example"
```

---

## Task 12: Create Grafana Overview Dashboard

**Files:**
- Create: `docker/grafana/dashboards/overview.json`

**Step 1: Create the dashboard JSON**

Create `docker/grafana/dashboards/overview.json` with a dashboard containing:

- **Row 1:** Request rate (req/s), Error rate (%), Avg response time
- **Row 2:** Request latency histogram (p50, p95, p99) from Prometheus
- **Row 3:** Recent traces from Tempo
- **Row 4:** Recent logs from Loki

The dashboard JSON is large. Generate it using these Prometheus queries:

- Request rate: `rate(roviq_http_server_request_duration_seconds_count[5m])`
- Error rate: `sum(rate(roviq_http_server_request_duration_seconds_count{http_status_code=~"5.."}[5m])) / sum(rate(roviq_http_server_request_duration_seconds_count[5m])) * 100`
- P50 latency: `histogram_quantile(0.50, sum(rate(roviq_http_server_request_duration_seconds_bucket[5m])) by (le))`
- P95 latency: `histogram_quantile(0.95, sum(rate(roviq_http_server_request_duration_seconds_bucket[5m])) by (le))`
- P99 latency: `histogram_quantile(0.99, sum(rate(roviq_http_server_request_duration_seconds_bucket[5m])) by (le))`

Note: The `roviq_` prefix comes from the `namespace: roviq` in the otel-collector prometheus exporter config. Actual metric names depend on auto-instrumentation output — adjust queries after verifying actual metric names via Prometheus UI at `http://localhost:9090`.

**Step 2: Commit**

```bash
git add docker/grafana/dashboards/
git commit -m "feat(grafana): add pre-provisioned overview dashboard"
```

---

## Task 13: Run Full Verification

**Step 1: Lint**

Run: `pnpm run lint`
Expected: Zero errors

**Step 2: Typecheck**

Run: `pnpm run typecheck`
Expected: Zero errors

**Step 3: Unit tests**

Run: `pnpm run test`
Expected: All tests pass

**Step 4: Check for "school" occurrences**

Run: `git diff develop | grep -i "school"`
Expected: Zero results

**Step 5: Verify only expected files changed**

Run: `git diff --stat develop`
Expected: Only files listed in this plan

---

## Task 14: Integration Smoke Test

**Step 1: Start infrastructure**

Run: `tilt up` (or `docker compose -f docker/compose.infra.yaml up -d` if not using Tilt)

**Step 2: Verify observability services are healthy**

Run:
```bash
curl -s http://localhost:3200/ready    # Tempo
curl -s http://localhost:3100/ready    # Loki
curl -s http://localhost:9090/-/ready  # Prometheus
curl -s http://localhost:3001/api/health # Grafana
```
Expected: All return 200/ready

**Step 3: Verify health endpoint**

Run: `curl -s http://localhost:3000/health | jq .`
Expected:
```json
{
  "status": "ok",
  "info": {
    "redis": { "status": "up" }
  }
}
```

**Step 4: Verify traces appear in Tempo**

1. Make a GraphQL request: `curl -X POST http://localhost:3000/api/graphql -H 'Content-Type: application/json' -d '{"query":"{ __typename }"}'`
2. Open Grafana at `http://localhost:3001`
3. Navigate to Explore → Tempo → Search
4. Verify a trace appears for the api-gateway service

**Step 5: Verify logs appear in Loki**

1. In Grafana → Explore → Loki
2. Query: `{service_name="api-gateway"}`
3. Verify structured JSON logs appear with `trace_id` field

**Step 6: Verify metrics appear in Prometheus**

1. Open `http://localhost:9090`
2. Query: `roviq_http_server_request_duration_seconds_count`
3. Verify metrics are being collected

---

## Summary of Files

### Created
- `docker/otel/collector-config.yaml`
- `docker/prometheus/prometheus.yaml`
- `docker/tempo/tempo-config.yaml`
- `docker/loki/loki-config.yaml`
- `docker/grafana/provisioning/datasources/datasources.yaml`
- `docker/grafana/provisioning/dashboards/dashboard.yaml`
- `docker/grafana/dashboards/overview.json`
- `libs/backend/telemetry/project.json`
- `libs/backend/telemetry/package.json`
- `libs/backend/telemetry/tsconfig.json`
- `libs/backend/telemetry/tsconfig.lib.json`
- `libs/backend/telemetry/src/index.ts`
- `libs/backend/telemetry/src/init-telemetry.ts`
- `libs/backend/telemetry/src/telemetry.module.ts`
- `apps/api-gateway/src/health/health.module.ts`
- `apps/api-gateway/src/health/health.controller.ts`
- `apps/api-gateway/src/health/indicators/redis.health.ts`
- `apps/api-gateway/src/health/__tests__/health.controller.spec.ts`

### Modified
- `package.json` (dependencies)
- `pnpm-lock.yaml`
- `tsconfig.base.json` (path alias)
- `docker/compose.infra.yaml` (5 new services)
- `Tiltfile` (observability resources)
- `apps/api-gateway/src/main.ts` (OTel init + Pino logger)
- `apps/api-gateway/src/app/app.module.ts` (TelemetryModule + HealthModule)
- `apps/api-gateway/src/auth/middleware/tenant.middleware.ts` (tenantId log enrichment)
- `.env.example` (OTEL vars)
