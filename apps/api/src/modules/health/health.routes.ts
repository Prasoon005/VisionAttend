import { Router } from 'express';
import { createHealthController } from './health.controller.js';
import type { HealthService } from './health.service.js';

export function createHealthRouter(service: HealthService): Router {
  const controller = createHealthController(service);
  const router = Router();

  router.get('/', controller.liveness);
  router.get('/ready', controller.readiness);

  return router;
}
