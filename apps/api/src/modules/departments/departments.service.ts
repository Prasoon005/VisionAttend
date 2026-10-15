import type {
  CreateDepartmentRequest,
  Department,
  DepartmentListResponse,
  UpdateDepartmentRequest,
} from '@visionattend/shared';
import type { Department as DepartmentRow, PrismaClient } from '../../generated/prisma/client.js';
import { ConflictError, NotFoundError } from '../../lib/errors.js';
import type { RequestMeta, TenantContext } from '../../lib/request-context.js';
import type { AuditService } from '../audit/audit.service.js';

type DepartmentWithCount = DepartmentRow & { _count: { employees: number } };

const withEmployeeCount = { _count: { select: { employees: true } } } as const;

/**
 * Tenant-scoped: every method takes the caller's TenantContext and filters on
 * its organizationId, so another organization's department is simply "not found".
 * Each change is written in one transaction with its audit row.
 */
export class DepartmentsService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly audit: AuditService,
  ) {}

  async list(ctx: TenantContext): Promise<DepartmentListResponse> {
    const rows = await this.prisma.department.findMany({
      where: { organizationId: ctx.organizationId },
      include: withEmployeeCount,
      orderBy: { name: 'asc' },
    });
    return { items: rows.map(toDepartment) };
  }

  /** A duplicate name in the same organization surfaces as 409 through the error handler. */
  async create(
    ctx: TenantContext,
    input: CreateDepartmentRequest,
    meta: RequestMeta,
  ): Promise<Department> {
    const created = await this.prisma.$transaction(async (tx) => {
      const department = await tx.department.create({
        data: { organizationId: ctx.organizationId, name: input.name, code: input.code ?? null },
        include: withEmployeeCount,
      });
      await this.audit.recordIn(
        tx,
        {
          action: 'department.create',
          entityType: 'Department',
          entityId: department.id,
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          metadata: { name: department.name, code: department.code },
        },
        meta,
      );
      return department;
    });
    return toDepartment(created);
  }

  async update(
    ctx: TenantContext,
    id: string,
    input: UpdateDepartmentRequest,
    meta: RequestMeta,
  ): Promise<Department> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const key = { organizationId_id: { organizationId: ctx.organizationId, id } };
      if (!(await tx.department.findUnique({ where: key, select: { id: true } }))) {
        throw new NotFoundError('Department not found');
      }
      const department = await tx.department.update({
        where: key,
        data: input,
        include: withEmployeeCount,
      });
      await this.audit.recordIn(
        tx,
        {
          action: 'department.update',
          entityType: 'Department',
          entityId: id,
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          metadata: { changes: { ...input } },
        },
        meta,
      );
      return department;
    });
    return toDepartment(updated);
  }

  /**
   * Refuses while employees still belong to the department, so nobody is left
   * pointing at a deleted row. The check gives a helpful message; the
   * ON DELETE RESTRICT foreign key still guards against a concurrent assignment.
   */
  async delete(ctx: TenantContext, id: string, meta: RequestMeta): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const key = { organizationId_id: { organizationId: ctx.organizationId, id } };
      const department = await tx.department.findUnique({ where: key, include: withEmployeeCount });
      if (!department) throw new NotFoundError('Department not found');

      const employees = department._count.employees;
      if (employees > 0) {
        throw new ConflictError(
          `Move the ${employees} employee${employees === 1 ? '' : 's'} in this department elsewhere first`,
          { employeeCount: employees },
        );
      }

      await tx.department.delete({ where: key });
      await this.audit.recordIn(
        tx,
        {
          action: 'department.delete',
          entityType: 'Department',
          entityId: id,
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          metadata: { name: department.name },
        },
        meta,
      );
    });
  }
}

function toDepartment(row: DepartmentWithCount): Department {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    employeeCount: row._count.employees,
    createdAt: row.createdAt.toISOString(),
  };
}
