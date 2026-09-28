import { randomUUID } from 'node:crypto';
import {
  ROLE_PERMISSIONS,
  type AuthSessionResponse,
  type AuthUser,
  type ChangePasswordRequest,
  type LoginRequest,
} from '@visionattend/shared';
import type { Organization, PrismaClient, User } from '../../generated/prisma/client.js';
import { AppError, ForbiddenError, UnauthenticatedError } from '../../lib/errors.js';
import { hashPassword, verifyDummyPassword, verifyPassword } from '../../lib/password.js';
import type { RequestMeta } from '../../lib/request-context.js';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  generateRefreshToken,
  hashRefreshToken,
  REFRESH_TOKEN_TTL_MS,
  type TokenService,
} from '../../lib/tokens.js';
import type { AuditService } from '../audit/audit.service.js';

export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_MS = 15 * 60 * 1000;

type UserWithOrganization = User & { organization: Organization | null };

/** A new session: the JSON body plus the refresh token that goes into the cookie. */
export interface IssuedSession {
  body: AuthSessionResponse;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

/** One message for every credential failure, so responses do not reveal which part was wrong. */
const invalidCredentials = () =>
  new UnauthenticatedError('Invalid email or password', 'INVALID_CREDENTIALS');
const invalidRefreshToken = () =>
  new UnauthenticatedError('Session expired, please sign in again', 'SESSION_EXPIRED');

export class AuthService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
    /** Injectable clock so lockout and expiry can be tested deterministically. */
    private readonly now: () => Date = () => new Date(),
  ) {}

  async login({ email, password }: LoginRequest, meta: RequestMeta): Promise<IssuedSession> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { organization: true },
    });

    if (!user) {
      await verifyDummyPassword(password);
      await this.audit.record(
        {
          action: 'auth.login_failed',
          entityType: 'User',
          metadata: { email, reason: 'unknown_email' },
        },
        meta,
      );
      throw invalidCredentials();
    }

    const failed = (reason: string) =>
      this.audit.record(
        {
          action: 'auth.login_failed',
          entityType: 'User',
          entityId: user.id,
          organizationId: user.organizationId,
          actorUserId: user.id,
          metadata: { reason },
        },
        meta,
      );

    // A locked account answers exactly like a wrong password (and still costs
    // a hash), so lockout cannot be used to discover which emails exist.
    if (user.lockedUntil && user.lockedUntil > this.now()) {
      await verifyDummyPassword(password);
      await failed('locked');
      throw invalidCredentials();
    }

    if (!(await verifyPassword(user.passwordHash, password))) {
      await this.registerFailedLogin(user);
      await failed('wrong_password');
      throw invalidCredentials();
    }

    // The password is right, so it is safe to say why access is refused.
    this.assertCanSignIn(user);

    return this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: this.now() },
      });
      await this.audit.recordIn(
        tx,
        {
          action: 'auth.login',
          entityType: 'User',
          entityId: user.id,
          organizationId: user.organizationId,
          actorUserId: user.id,
        },
        meta,
      );
      return (await this.issueSession(tx, user, randomUUID(), meta)).issued;
    });
  }

  /**
   * Refresh-token rotation with reuse detection.
   *
   * Each refresh token works once. Presenting one that was already rotated
   * means two parties hold the same token, one of them an attacker (it was
   * stolen), so the whole family (every token descended from that login) is
   * revoked and both have to sign in again.
   */
  async refresh(rawToken: string, meta: RequestMeta): Promise<IssuedSession> {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashRefreshToken(rawToken) },
      include: { user: { include: { organization: true } } },
    });
    if (!stored) throw invalidRefreshToken();

    const { user } = stored;

    if (stored.revokedAt) {
      if (stored.replacedById) await this.handleReuse(stored.familyId, user, meta);
      throw invalidRefreshToken();
    }
    if (stored.expiresAt <= this.now()) throw invalidRefreshToken();

    try {
      this.assertCanSignIn(user);
    } catch (error) {
      await this.revokeFamily(stored.familyId);
      throw error;
    }

    return this.prisma
      .$transaction(async (tx) => {
        const session = await this.issueSession(tx, user, stored.familyId, meta);
        // Conditional update: if a concurrent request rotated this token first,
        // no row matches and that is treated as reuse.
        const { count } = await tx.refreshToken.updateMany({
          where: { id: stored.id, revokedAt: null },
          data: { revokedAt: this.now(), replacedById: session.refreshTokenId },
        });
        if (count === 0) throw new ReuseDetected();
        return session.issued;
      })
      .catch(async (error: unknown) => {
        if (error instanceof ReuseDetected) {
          await this.handleReuse(stored.familyId, user, meta);
          throw invalidRefreshToken();
        }
        throw error;
      });
  }

  /** Ends the session on this device. Idempotent: unknown tokens are ignored. */
  async logout(rawToken: string | undefined, meta: RequestMeta): Promise<void> {
    if (!rawToken) return;
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashRefreshToken(rawToken) },
      select: { familyId: true, user: { select: { id: true, organizationId: true } } },
    });
    if (!stored) return;
    await this.revokeFamily(stored.familyId);
    await this.audit.record(
      {
        action: 'auth.logout',
        entityType: 'User',
        entityId: stored.user.id,
        organizationId: stored.user.organizationId,
        actorUserId: stored.user.id,
      },
      meta,
    );
  }

  /**
   * Changes the password, signs the user out everywhere else (all refresh
   * tokens revoked) and returns a fresh session for the current device.
   */
  async changePassword(
    userId: string,
    { currentPassword, newPassword }: ChangePasswordRequest,
    meta: RequestMeta,
  ): Promise<IssuedSession> {
    const user = await this.findUserOrFail(userId);
    if (!(await verifyPassword(user.passwordHash, currentPassword))) {
      throw new AppError(400, 'INVALID_CURRENT_PASSWORD', 'Current password is incorrect');
    }
    this.assertCanSignIn(user);
    const passwordHash = await hashPassword(newPassword);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: user.id },
        data: { passwordHash, mustChangePassword: false, failedLoginCount: 0, lockedUntil: null },
        include: { organization: true },
      });
      await tx.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: this.now() },
      });
      await this.audit.recordIn(
        tx,
        {
          action: 'auth.password_changed',
          entityType: 'User',
          entityId: user.id,
          organizationId: user.organizationId,
          actorUserId: user.id,
        },
        meta,
      );
      return (await this.issueSession(tx, updated, randomUUID(), meta)).issued;
    });
  }

  async me(userId: string): Promise<AuthUser> {
    return toAuthUser(await this.findUserOrFail(userId));
  }

  // ───────────────────────────── internals ─────────────────────────────

  private async findUserOrFail(userId: string): Promise<UserWithOrganization> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { organization: true },
    });
    // The token was valid but the user is gone: treat as signed out.
    if (!user) throw new UnauthenticatedError();
    return user;
  }

  private assertCanSignIn(user: UserWithOrganization): void {
    if (user.status !== 'ACTIVE') {
      throw new ForbiddenError('This account has been disabled', 'ACCOUNT_DISABLED');
    }
    if (user.organization && user.organization.status !== 'ACTIVE') {
      throw new ForbiddenError('This organization is suspended', 'ORGANIZATION_SUSPENDED');
    }
  }

  private async registerFailedLogin(user: User): Promise<void> {
    // Atomic increment: parallel guesses cannot all read the same old count.
    const { failedLoginCount } = await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: { increment: 1 } },
      select: { failedLoginCount: true },
    });
    if (failedLoginCount >= MAX_FAILED_LOGINS) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: 0,
          lockedUntil: new Date(this.now().getTime() + LOCKOUT_MS),
        },
      });
    }
  }

  private async handleReuse(familyId: string, user: User, meta: RequestMeta): Promise<void> {
    await this.revokeFamily(familyId);
    await this.audit.record(
      {
        action: 'auth.refresh_reuse',
        entityType: 'User',
        entityId: user.id,
        organizationId: user.organizationId,
        actorUserId: user.id,
        metadata: { familyId },
      },
      meta,
    );
  }

  private async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: this.now() },
    });
  }

  private async issueSession(
    tx: Pick<PrismaClient, 'refreshToken'>,
    user: UserWithOrganization,
    familyId: string,
    meta: RequestMeta,
  ): Promise<{ issued: IssuedSession; refreshTokenId: string }> {
    const refreshToken = generateRefreshToken();
    const refreshTokenExpiresAt = new Date(this.now().getTime() + REFRESH_TOKEN_TTL_MS);
    const { id } = await tx.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashRefreshToken(refreshToken),
        familyId,
        expiresAt: refreshTokenExpiresAt,
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
      select: { id: true },
    });
    const accessToken = await this.tokens.signAccessToken({
      userId: user.id,
      role: user.role,
      organizationId: user.organizationId,
      mustChangePassword: user.mustChangePassword,
    });

    return {
      issued: {
        body: { accessToken, expiresIn: ACCESS_TOKEN_TTL_SECONDS, user: toAuthUser(user) },
        refreshToken,
        refreshTokenExpiresAt,
      },
      refreshTokenId: id,
    };
  }
}

class ReuseDetected extends Error {}

export function toAuthUser(user: UserWithOrganization): AuthUser {
  const { organization } = user;
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    organization: organization && {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      timezone: organization.timezone,
    },
    mustChangePassword: user.mustChangePassword,
    permissions: [...ROLE_PERMISSIONS[user.role]],
  };
}
