import { z } from 'zod';

export const dependencyStatusSchema = z.enum(['up', 'down']);

export const dependencyCheckSchema = z.object({
  status: dependencyStatusSchema,
  latencyMs: z.number().nonnegative(),
  error: z.string().optional(),
});

/** GET /api/v1/health — liveness: is the process running? */
export const livenessResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.literal('api'),
  version: z.string(),
  uptimeSeconds: z.number().nonnegative(),
  timestamp: z.iso.datetime(),
});

/** GET /api/v1/health/ready — readiness: can the API serve real traffic? */
export const readinessResponseSchema = z.object({
  status: z.enum(['ready', 'degraded']),
  checks: z.object({
    database: dependencyCheckSchema,
    redis: dependencyCheckSchema,
    cvService: dependencyCheckSchema,
  }),
  timestamp: z.iso.datetime(),
});

export type DependencyStatus = z.infer<typeof dependencyStatusSchema>;
export type DependencyCheck = z.infer<typeof dependencyCheckSchema>;
export type LivenessResponse = z.infer<typeof livenessResponseSchema>;
export type ReadinessResponse = z.infer<typeof readinessResponseSchema>;
