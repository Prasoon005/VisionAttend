import { randomUUID } from 'node:crypto';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import type { PrismaClient } from './generated/prisma/client.js';
import type { Logger } from './lib/logger.js';
import type { RateLimiter } from './lib/rate-limiter.js';
import { TokenService } from './lib/tokens.js';
import { createAuthenticate } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { rateLimit } from './middleware/rate-limit.js';
import { AuditLogRepository } from './modules/audit/audit.repository.js';
import { createAuditRouter } from './modules/audit/audit.routes.js';
import { AuditService } from './modules/audit/audit.service.js';
import { createAuthRouter } from './modules/auth/auth.routes.js';
import { AuthService } from './modules/auth/auth.service.js';
import { createHealthRouter } from './modules/health/health.routes.js';
import type { HealthService } from './modules/health/health.service.js';
import { createOrganizationsRouter } from './modules/organizations/organizations.routes.js';
import { OrganizationsService } from './modules/organizations/organizations.service.js';

export interface AppDependencies {
  logger: Logger;
  corsOrigins: string[];
  healthService: HealthService;
  prisma: PrismaClient;
  rateLimiter: RateLimiter;
  jwtSecret: string;
  /** Injectable clock for deterministic tests. */
  now?: () => Date;
}

const REQUEST_ID_PATTERN = /^[\w-]{8,64}$/;

/**
 * Builds the Express application. Dependencies are injected so tests can
 * swap the clock, the rate limiter or the database.
 */
export function createApp(deps: AppDependencies): Express {
  const app = express();

  // Trust X-Forwarded-For only from proxies on loopback or private networks
  // (Vite dev proxy, nginx in Compose), so `req.ip` is the real client for
  // rate limiting and audit logs but cannot be spoofed from the internet.
  app.set('trust proxy', 'loopback, uniquelocal');

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
      credentials: true, // refresh-token cookie
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  // Composition root: build services once and hand them to their routers.
  const tokens = new TokenService(deps.jwtSecret);
  const authenticate = createAuthenticate(tokens);
  const audit = new AuditService(deps.prisma, deps.logger);
  const authService = new AuthService(deps.prisma, tokens, audit, deps.now);
  const organizationsService = new OrganizationsService(deps.prisma, audit);

  const v1 = express.Router();
  // Health stays outside the rate limit: load balancers poll it constantly.
  v1.use('/health', createHealthRouter(deps.healthService));
  v1.use(rateLimit(deps.rateLimiter, { name: 'api', limit: 300, windowMs: 60_000 }));
  v1.use('/auth', createAuthRouter(authService, authenticate, deps.rateLimiter));
  v1.use('/platform/organizations', createOrganizationsRouter(organizationsService, authenticate));
  v1.use('/audit-logs', createAuditRouter(new AuditLogRepository(deps.prisma), authenticate));
  app.use('/api/v1', v1);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
