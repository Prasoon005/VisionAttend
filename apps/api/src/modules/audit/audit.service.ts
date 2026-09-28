import type { AuditAction } from '@visionattend/shared';
import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import type { Logger } from '../../lib/logger.js';
import type { RequestMeta } from '../../lib/request-context.js';

export interface AuditEntry {
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  organizationId?: string | null;
  actorUserId?: string | null;
  /** Never put passwords, tokens or biometric data in here. */
  metadata?: Prisma.InputJsonObject;
}

/** Anything that can write rows: the client itself or a transaction. */
type AuditWriter = Pick<PrismaClient, 'auditLog'>;

/** Writes the append-only audit trail. */
export class AuditService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly logger: Logger,
  ) {}

  private toRow(entry: AuditEntry, meta: RequestMeta): Prisma.AuditLogCreateInput {
    return {
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      organizationId: entry.organizationId ?? null,
      actorUserId: entry.actorUserId ?? null,
      ...(entry.metadata && { metadata: entry.metadata }),
      requestId: meta.requestId,
      ip: meta.ip,
      userAgent: meta.userAgent,
    };
  }

  /**
   * Records an entry inside the caller's transaction, so the change and its
   * audit row are committed (or rolled back) together.
   */
  async recordIn(tx: AuditWriter, entry: AuditEntry, meta: RequestMeta): Promise<void> {
    await tx.auditLog.create({ data: this.toRow(entry, meta) });
  }

  /**
   * Best-effort record for events that are not part of a data change (e.g. a
   * failed login). A failure is logged but never turns the request into a 500.
   */
  async record(entry: AuditEntry, meta: RequestMeta): Promise<void> {
    try {
      await this.recordIn(this.prisma, entry, meta);
    } catch (error) {
      this.logger.error({ err: error, action: entry.action }, 'failed to write audit log');
    }
  }
}
