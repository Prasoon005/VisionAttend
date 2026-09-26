import { pino, type Logger } from 'pino';

export type { Logger };

/**
 * Structured JSON logger. Credentials are redacted at the logger level so a
 * careless `logger.info({ req })` can never leak them.
 */
export function createLogger(options: { level: string; pretty: boolean }): Logger {
  return pino({
    level: options.level,
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.headers["x-service-token"]',
        'res.headers["set-cookie"]',
        '*.password',
        '*.passwordHash',
        '*.token',
        '*.refreshToken',
      ],
      censor: '[REDACTED]',
    },
    ...(options.pretty && {
      transport: { target: 'pino-pretty', options: { colorize: true, ignore: 'pid,hostname' } },
    }),
  });
}
