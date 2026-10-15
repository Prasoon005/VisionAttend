import { Router } from 'express';
import { z } from 'zod';
import { createDepartmentRequestSchema, updateDepartmentRequestSchema } from '@visionattend/shared';
import { getRequestMeta, getTenant } from '../../lib/request-context.js';
import { requirePermission, type Authenticate } from '../../middleware/auth.js';
import type { DepartmentsService } from './departments.service.js';

const idParamsSchema = z.object({ id: z.uuid() });

export function createDepartmentsRouter(
  service: DepartmentsService,
  authenticate: Authenticate,
): Router {
  const router = Router();
  router.use(authenticate());

  // Reading is part of employee management: the employee form picks from this list.
  router.get('/', requirePermission('employee:read'), async (req, res) => {
    res.json(await service.list(getTenant(req)));
  });

  router.post('/', requirePermission('department:write'), async (req, res) => {
    const body = createDepartmentRequestSchema.parse(req.body);
    res.status(201).json(await service.create(getTenant(req), body, getRequestMeta(req)));
  });

  router.patch('/:id', requirePermission('department:write'), async (req, res) => {
    const { id } = idParamsSchema.parse(req.params);
    const body = updateDepartmentRequestSchema.parse(req.body);
    res.json(await service.update(getTenant(req), id, body, getRequestMeta(req)));
  });

  router.delete('/:id', requirePermission('department:write'), async (req, res) => {
    const { id } = idParamsSchema.parse(req.params);
    await service.delete(getTenant(req), id, getRequestMeta(req));
    res.status(204).end();
  });

  return router;
}
