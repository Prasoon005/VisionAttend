import { z } from 'zod';
import { paginationQuerySchema, paginatedSchema } from './pagination.js';

/** Audit actions written by the API. Add new ones here so the UI can label them. */
export const AUDIT_ACTIONS = [
  'auth.login',
  'auth.login_failed',
  'auth.logout',
  'auth.refresh_reuse',
  'auth.password_changed',
  'organization.create',
  'organization.update',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const auditLogEntrySchema = z.object({
  id: z.uuid(),
  action: z.string(),
  entityType: z.string(),
  entityId: z.string().nullable(),
  actorUserId: z.uuid().nullable(),
  metadata: z.unknown(),
  requestId: z.string().nullable(),
  ip: z.string().nullable(),
  createdAt: z.iso.datetime(),
});

export const listAuditLogsQuerySchema = paginationQuerySchema;
export const auditLogListResponseSchema = paginatedSchema(auditLogEntrySchema);

export type AuditLogEntry = z.infer<typeof auditLogEntrySchema>;
export type AuditLogListResponse = z.infer<typeof auditLogListResponseSchema>;
