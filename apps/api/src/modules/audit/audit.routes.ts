import { Router } from 'express';
import { z } from 'zod';
import { listAuditLogsQuerySchema } from '@visionattend/shared';
import { NotFoundError } from '../../lib/errors.js';
import { getTenant } from '../../lib/request-context.js';
import { requirePermission, type Authenticate } from '../../middleware/auth.js';
import type { AuditLogRepository } from './audit.repository.js';

const idParamsSchema = z.object({ id: z.uuid() });

export function createAuditRouter(repository: AuditLogRepository, authenticate: Authenticate) {
  const router = Router();
  router.use(authenticate(), requirePermission('audit:read'));

  router.get('/', async (req, res) => {
    const query = listAuditLogsQuerySchema.parse(req.query);
    res.json(await repository.list(getTenant(req), query));
  });

  router.get('/:id', async (req, res) => {
    const { id } = idParamsSchema.parse(req.params);
    const entry = await repository.findById(getTenant(req), id);
    if (!entry) throw new NotFoundError('Audit log entry not found');
    res.json(entry);
  });

  return router;
}
