# ROV-24: OpenTelemetry + Grafana Observability Stack

## Overview

Integrate OpenTelemetry SDK into all NestJS services for distributed tracing, structured logging, and metrics collection. Add the full Grafana LGTM stack (Loki, Grafana, Tempo, Prometheus) to Docker infrastructure.

## Architecture

```
NestJS Apps (api-gateway, institute-service)
    │  OTLP gRPC (:4317)
    ▼
┌──────────────────────┐
│   OTel Collector      │
│   :4317 (gRPC)        │──► Tempo (:3200)      — traces
│   :4318 (HTTP)        │──► Loki (:3100/otlp)  — logs
│   :8889 (metrics)     │──► Prometheus (:9090)  — metrics (scrapes :8889)
└──────────────────────┘
                              │
                        Grafana (:3001)
                        (unified dashboards)
```

### Data flow

1. NestJS apps initialize OTel SDK **before** NestJS bootstrap (first import in `main.ts`)
2. Auto-instrumentations capture HTTP, GraphQL, Prisma, NestJS spans automatically
3. `nestjs-pino` produces structured JSON logs; `@opentelemetry/instrumentation-pino` auto-injects `trace_id`, `span_id`, `trace_flags` into every log line
4. OTel SDK sends traces + logs via OTLP gRPC to the collector
5. Collector routes: traces → Tempo, logs → Loki (native OTLP endpoint), metrics → Prometheus exporter
6. Grafana queries all three backends with auto-provisioned data sources

## Docker Services

Added to `docker/compose.infra.yaml`:

| Service | Image | Ports | Purpose |
|---|---|---|---|
| otel-collector | `otel/opentelemetry-collector-contrib` | 4317, 4318 | Receives OTLP, routes to backends |
| prometheus | `prom/prometheus` | 9090 | Scrapes metrics from collector :8889 |
| tempo | `grafana/tempo` | 3200 | Distributed tracing backend |
| loki | `grafana/loki` | 3100 | Log aggregation (native OTLP ingestion) |
| grafana | `grafana/grafana` | 3001 | Dashboards (3001 to avoid api-gateway conflict) |

### Config files

```
docker/
├── otel/
│   └── collector-config.yaml
├── prometheus/
│   └── prometheus.yaml
├── tempo/
│   └── tempo-config.yaml
├── loki/
│   └── loki-config.yaml
└── grafana/
    ├── provisioning/
    │   └── datasources/
    │       └── datasources.yaml
    └── dashboards/
        ├── dashboard.yaml          # provisioning config
        └── overview.json           # pre-built dashboard
```

### OTel Collector config

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

## Shared Library: `@roviq/telemetry`

New library at `libs/backend/telemetry/`.

### `init-telemetry.ts`

Called as the **first import** in each app's `main.ts`, before any NestJS code.

```typescript
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { BatchSpanProcessor, ParentBasedSampler, TraceIdRatioBasedSampler } from '@opentelemetry/sdk-trace-base';
import { PinoInstrumentation } from '@opentelemetry/instrumentation-pino';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

const isProduction = process.env.NODE_ENV === 'production';

const sdk = new NodeSDK({
  sampler: new ParentBasedSampler({
    root: new TraceIdRatioBasedSampler(isProduction ? 0.1 : 1.0),
  }),
  spanProcessor: new BatchSpanProcessor(
    new OTLPTraceExporter({
      url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4317',
    }),
    {
      maxExportBatchSize: isProduction ? 200 : 50,
      scheduledDelayMillis: isProduction ? 2000 : 1000,
    },
  ),
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'unknown',
    [ATTR_SERVICE_VERSION]: process.env.OTEL_SERVICE_VERSION || '0.0.0',
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },
      '@opentelemetry/instrumentation-dns': { enabled: false },
      '@opentelemetry/instrumentation-http': {
        ignoreIncomingRequestHook: (req) => {
          const ignore = ['/health', '/metrics', '/favicon.ico'];
          return ignore.some((p) => req.url?.startsWith(p)) || false;
        },
      },
    }),
    new PinoInstrumentation(), // auto-injects trace_id, span_id into Pino logs
  ],
});

sdk.start();
```

### Key design decisions

- **gRPC exporter** (not HTTP) — more efficient for high-throughput trace/log shipping
- **`PinoInstrumentation`** — automatically correlates logs with traces; no manual `trace_id` injection needed
- **Disable `fs`/`dns`** — eliminates noise from Node.js internals
- **Ignore `/health` and `/metrics`** — prevents health check polling from flooding traces
- **100% sampling in dev, 10% in prod** — full visibility locally, controlled volume in production

### `telemetry.module.ts`

NestJS module that configures `nestjs-pino` as the global logger:

```typescript
import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL || 'info',
        transport: process.env.NODE_ENV !== 'production'
          ? { target: 'pino-pretty' }
          : undefined,
        genReqId: (req) => req.headers['x-request-id'] || crypto.randomUUID(),
      },
      exclude: [{ method: RequestMethod.ALL, path: 'health' }],
    }),
  ],
  exports: [LoggerModule],
})
export class TelemetryModule {}
```

## App Integration

### `main.ts` (api-gateway)

```typescript
// MUST be first import — initializes OTel before NestJS
import '@roviq/telemetry/init';

import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  // ... existing setup (helmet, CORS, validation pipe)
  await app.listen(port);
}
bootstrap();
```

### Tenant context enrichment

Use `PinoLogger.assign()` in the existing `TenantMiddleware` to add `tenantId` to all logs within a request:

```typescript
// In tenant middleware, after setting tenant context:
pinoLogger.assign({ tenantId });
```

## Health Check Endpoints

Using `@nestjs/terminus` in each NestJS service.

### Health module

```typescript
@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [RedisHealthIndicator],
})
export class HealthModule {}
```

### Health controller

```typescript
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private prisma: PrismaHealthIndicator,
    private microservice: MicroserviceHealthIndicator,
    private redis: RedisHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.prisma.pingCheck('db'),
      () => this.microservice.pingCheck('nats', { transport: Transport.NATS }),
      () => this.redis.isHealthy('redis'),
    ]);
  }
}
```

### Response shape

```json
{
  "status": "ok",
  "info": {
    "db": { "status": "up" },
    "nats": { "status": "up" },
    "redis": { "status": "up" }
  }
}
```

## Grafana Provisioning

### Auto-provisioned data sources

```yaml
apiVersion: 1
datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
  - name: Tempo
    type: tempo
    access: proxy
    url: http://tempo:3200
  - name: Loki
    type: loki
    access: proxy
    url: http://loki:3100
```

### Pre-built dashboard

One `overview.json` dashboard covering acceptance criteria:
- Request latency: p50, p95, p99 (from Prometheus histogram)
- Error rate (from Prometheus counter)
- Active connections (from Prometheus gauge)
- Trace-to-log correlation via `traceId` (Tempo → Loki link)

## Tiltfile Updates

- Add observability services to `docker_compose()` resource
- Add Grafana link: `link('Grafana', 'http://localhost:3001')`
- Health check dependency: api-gateway depends on otel-collector being ready

## Environment Variables

Added to `.env.example` and per-app `.env.example` files:

```env
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
OTEL_SERVICE_NAME=api-gateway
OTEL_SERVICE_VERSION=0.0.0
LOG_LEVEL=info
```

## NPM Packages

### Production dependencies (workspace root or shared lib)

```
@opentelemetry/api
@opentelemetry/sdk-node
@opentelemetry/auto-instrumentations-node
@opentelemetry/exporter-trace-otlp-grpc
@opentelemetry/sdk-trace-base
@opentelemetry/instrumentation-pino
@opentelemetry/resources
@opentelemetry/semantic-conventions
nestjs-pino
pino-http
nestjs-otel
@nestjs/terminus
```

### Dev dependencies

```
pino-pretty
```

## Out of Scope

- Frontend (Next.js) instrumentation
- Sentry integration
- Custom business metrics beyond HTTP/GraphQL defaults
- Alerting rules
- Temporal workflow instrumentation
- Load testing / performance benchmarks

## Acceptance Criteria Mapping

| Criteria | How it's met |
|---|---|
| Request trace shows full journey through services | OTel auto-instrumentation + OTLP → Tempo → Grafana |
| Grafana dashboard: latency p50/p95/p99, error rate, connections | Pre-provisioned `overview.json` dashboard |
| Logs searchable by traceId, tenantId, service | Pino + PinoInstrumentation auto-injects trace_id; assign() adds tenantId |
| `/health` returns DB, NATS, Redis status | @nestjs/terminus with PrismaHealthIndicator, MicroserviceHealthIndicator, custom RedisHealthIndicator |
