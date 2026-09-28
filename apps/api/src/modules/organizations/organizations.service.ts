import type {
  CreateOrganizationRequest,
  CreateOrganizationResponse,
  Organization,
  OrganizationListResponse,
  PaginationQuery,
  UpdateOrganizationRequest,
} from '@visionattend/shared';
import type {
  Organization as OrganizationRow,
  PrismaClient,
} from '../../generated/prisma/client.js';
import { NotFoundError } from '../../lib/errors.js';
import { generateTemporaryPassword, hashPassword } from '../../lib/password.js';
import type { RequestMeta } from '../../lib/request-context.js';
import type { AuditService } from '../audit/audit.service.js';

type OrganizationWithCount = OrganizationRow & { _count: { users: number } };

const withUserCount = { _count: { select: { users: true } } } as const;

/**
 * Platform-level organization management (Super Admin only). This is the one
 * module that is deliberately *not* tenant-scoped: it manages the tenants.
 */
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly audit: AuditService,
  ) {}

  async list({ page, pageSize }: PaginationQuery): Promise<OrganizationListResponse> {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.organization.findMany({
        include: withUserCount,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.organization.count(),
    ]);
    return { items: rows.map(toOrganization), total, page, pageSize };
  }

  /**
   * Creates the organization and its first Org Admin in one transaction, so
   * there is never an organization nobody can administer. The admin gets a
   * generated one-time password that must be changed at first sign-in.
   * A duplicate slug or email surfaces as 409 through the error handler.
   */
  async create(
    input: CreateOrganizationRequest,
    actorUserId: string,
    meta: RequestMeta,
  ): Promise<CreateOrganizationResponse> {
    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);

    const { organization, admin } = await this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: { name: input.name, slug: input.slug, timezone: input.timezone },
      });
      const admin = await tx.user.create({
        data: {
          organizationId: organization.id,
          email: input.adminEmail,
          passwordHash,
          role: 'ORG_ADMIN',
          mustChangePassword: true,
        },
        select: { id: true, email: true },
      });
      await this.audit.recordIn(
        tx,
        {
          action: 'organization.create',
          entityType: 'Organization',
          entityId: organization.id,
          organizationId: organization.id,
          actorUserId,
          metadata: { slug: organization.slug, adminUserId: admin.id },
        },
        meta,
      );
      return { organization, admin };
    });

    return {
      organization: toOrganization({ ...organization, _count: { users: 1 } }),
      admin,
      temporaryPassword,
    };
  }

  /**
   * Suspending an organization revokes every refresh token of its users:
   * nobody can start a new session, and existing access tokens expire
   * within 15 minutes.
   */
  async update(
    id: string,
    input: UpdateOrganizationRequest,
    actorUserId: string,
    meta: RequestMeta,
  ): Promise<Organization> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.organization.findUnique({ where: { id } });
      if (!existing) throw new NotFoundError('Organization not found');

      const organization = await tx.organization.update({
        where: { id },
        data: input,
        include: withUserCount,
      });

      if (input.status === 'SUSPENDED' && existing.status !== 'SUSPENDED') {
        await tx.refreshToken.updateMany({
          where: { user: { organizationId: id }, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }

      await this.audit.recordIn(
        tx,
        {
          action: 'organization.update',
          entityType: 'Organization',
          entityId: id,
          organizationId: id,
          actorUserId,
          metadata: { changes: { ...input } },
        },
        meta,
      );
      return organization;
    });
    return toOrganization(updated);
  }
}

function toOrganization(row: OrganizationWithCount): Organization {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    timezone: row.timezone,
    status: row.status,
    userCount: row._count.users,
    createdAt: row.createdAt.toISOString(),
  };
}
