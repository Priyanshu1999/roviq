import pino from 'pino';

const isProduction = process.env['NODE_ENV'] === 'production';

/**
 * Root Pino logger instance shared across NestJS and standalone scripts.
 *
 * When OTel PinoInstrumentation is active (api-gateway, workers),
 * trace_id and span_id are automatically injected into every log line.
 *
 * For standalone scripts (partition scheduler, migrations), call
 * `createLogger('script-name')` to get a child with the script context.
 */
export const rootLogger = pino({
  level: process.env['LOG_LEVEL'] ?? (isProduction ? 'info' : 'debug'),
  ...(isProduction ? {} : { transport: { target: 'pino-pretty', options: { colorize: true } } }),
});

/**
 * Create a named child logger for a specific module or standalone script.
 *
 * @example
 * const logger = createLogger('partition-schedule');
 * logger.info('Schedule created');
 * // → {"level":30,"module":"partition-schedule","msg":"Schedule created",...}
 */
export function createLogger(module: string) {
  return rootLogger.child({ module });
}
