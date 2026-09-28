import { Router } from 'express';
import { z } from 'zod';
import {
  createOrganizationRequestSchema,
  listOrganizationsQuerySchema,
  updateOrganizationRequestSchema,
} from '@visionattend/shared';
import { getAuth, getRequestMeta } from '../../lib/request-context.js';
import { requirePermission, type Authenticate } from '../../middleware/auth.js';
import type { OrganizationsService } from './organizations.service.js';

const idParamsSchema = z.object({ id: z.uuid() });

export function createOrganizationsRouter(
  service: OrganizationsService,
  authenticate: Authenticate,
): Router {
  const router = Router();
  router.use(authenticate(), requirePermission('organization:manage'));

  router.get('/', async (req, res) => {
    res.json(await service.list(listOrganizationsQuerySchema.parse(req.query)));
  });

  router.post('/', async (req, res) => {
    const body = createOrganizationRequestSchema.parse(req.body);
    const result = await service.create(body, getAuth(req).userId, getRequestMeta(req));
    // Contains the one-time password: must not be cached anywhere.
    res.setHeader('Cache-Control', 'no-store');
    res.status(201).json(result);
  });

  router.patch('/:id', async (req, res) => {
    const { id } = idParamsSchema.parse(req.params);
    const body = updateOrganizationRequestSchema.parse(req.body);
    res.json(await service.update(id, body, getAuth(req).userId, getRequestMeta(req)));
  });

  return router;
}
