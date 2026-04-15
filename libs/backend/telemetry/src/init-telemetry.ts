import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { PinoInstrumentation } from '@opentelemetry/instrumentation-pino';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';
import {
  BatchSpanProcessor,
  ParentBasedSampler,
  TraceIdRatioBasedSampler,
} from '@opentelemetry/sdk-trace-base';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

const env = process.env;
const isProduction = env['NODE_ENV'] === 'production';
const otlpEndpoint = env['OTEL_EXPORTER_OTLP_ENDPOINT'] || 'http://localhost:4317';

const sdk = new NodeSDK({
  sampler: new ParentBasedSampler({
    root: new TraceIdRatioBasedSampler(isProduction ? 0.1 : 1.0),
  }),
  spanProcessors: [
    new BatchSpanProcessor(new OTLPTraceExporter({ url: otlpEndpoint }), {
      maxExportBatchSize: isProduction ? 200 : 50,
      scheduledDelayMillis: isProduction ? 2000 : 1000,
    }),
  ],
  metricReaders: [
    new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({ url: otlpEndpoint }),
      exportIntervalMillis: isProduction ? 60000 : 10000,
    }),
  ],
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: env['OTEL_SERVICE_NAME'] || 'unknown-service',
    [ATTR_SERVICE_VERSION]: env['OTEL_SERVICE_VERSION'] || '0.0.0',
    'deployment.environment.name': env['NODE_ENV'] || 'development',
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },
      '@opentelemetry/instrumentation-dns': { enabled: false },
      '@opentelemetry/instrumentation-net': { enabled: false },
      // Disabled: adds a `finish` listener to ServerResponse per router layer per request.
      // NestJS has 11+ layers, exceeding Node's EventEmitter.defaultMaxListeners of 10.
      // HTTP instrumentation already covers request lifecycle tracing for NestJS/Apollo.
      '@opentelemetry/instrumentation-router': { enabled: false },
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

const shutdown = () => {
  sdk
    .shutdown()
    .catch((err) => console.error('OTel SDK shutdown error', err))
    .finally(() => process.exit(0));
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
