import type { AuditLogEntry, PaginationQuery } from '@visionattend/shared';
import type { AuditLog, PrismaClient } from '../../generated/prisma/client.js';
import type { TenantContext } from '../../lib/request-context.js';

/**
 * Tenant-scoped repository: every method takes a TenantContext and adds
 * `organizationId` to the query itself, so a controller cannot forget it.
 */
export class AuditLogRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list(ctx: TenantContext, { page, pageSize }: PaginationQuery) {
    const where = { organizationId: ctx.organizationId };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items: rows.map(toEntry), total, page, pageSize };
  }

  /**
   * Returns null both when the entry does not exist and when it belongs to
   * another organization; the caller answers 404 in both cases, so the
   * existence of other tenants' data is never revealed.
   */
  async findById(ctx: TenantContext, id: string): Promise<AuditLogEntry | null> {
    const row = await this.prisma.auditLog.findFirst({
      where: { id, organizationId: ctx.organizationId },
    });
    return row && toEntry(row);
  }
}

function toEntry(row: AuditLog): AuditLogEntry {
  return {
    id: row.id,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    actorUserId: row.actorUserId,
    metadata: row.metadata,
    requestId: row.requestId,
    ip: row.ip,
    createdAt: row.createdAt.toISOString(),
  };
}
