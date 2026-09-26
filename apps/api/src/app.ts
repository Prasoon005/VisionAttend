import { randomUUID } from 'node:crypto';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import type { Logger } from './lib/logger.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { createHealthRouter } from './modules/health/health.routes.js';
import type { HealthService } from './modules/health/health.service.js';

export interface AppDependencies {
  logger: Logger;
  corsOrigins: string[];
  healthService: HealthService;
}

const REQUEST_ID_PATTERN = /^[\w-]{8,64}$/;

/**
 * Builds the Express application. Dependencies are injected so tests can
 * run the full middleware stack without a database, Redis or CV service.
 */
export function createApp(deps: AppDependencies): Express {
  const app = express();

  app.use(
    pinoHttp({
      logger: deps.logger,
      // Reuse a caller-supplied request id (e.g. from a gateway) when it is
      // well-formed, so one request can be traced across services.
      genReqId: (req, res) => {
        const incoming = req.headers['x-request-id'];
        const id =
          typeof incoming === 'string' && REQUEST_ID_PATTERN.test(incoming)
            ? incoming
            : randomUUID();
        res.setHeader('X-Request-Id', id);
        return id;
      },
      autoLogging: { ignore: (req) => req.url?.startsWith('/api/v1/health') ?? false },
    }),
  );
  app.use(helmet());
  app.use(
    cors({
      origin: deps.corsOrigins,
      credentials: true, // refresh-token cookie (Phase 2)
    }),
  );
  app.use(express.json({ limit: '100kb' }));

  const v1 = express.Router();
  v1.use('/health', createHealthRouter(deps.healthService));
  app.use('/api/v1', v1);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
