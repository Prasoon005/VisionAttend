import type { RequestHandler } from 'express';
import type { HealthService } from './health.service.js';

export function createHealthController(service: HealthService) {
  const liveness: RequestHandler = (_req, res) => {
    res.json(service.liveness());
  };

  const readiness: RequestHandler = async (_req, res) => {
    const report = await service.readiness();
    // 503 lets load balancers and orchestrators stop routing traffic here.
    res.status(report.status === 'ready' ? 200 : 503).json(report);
  };

  return { liveness, readiness };
}
