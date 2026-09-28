import { z } from 'zod';
import { PERMISSIONS } from './permissions.js';
import { ROLES } from './roles.js';

/** Emails are compared and stored lower-cased (a CHECK constraint enforces it). */
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));

/**
 * Password policy (NIST SP 800-63B): length matters more than composition
 * rules. The upper bound stops attackers from making the server hash
 * megabyte-sized "passwords".
 */
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

export const newPasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(PASSWORD_MAX_LENGTH, `Password must be at most ${PASSWORD_MAX_LENGTH} characters`);

/** POST /auth/login. No length rules here: they would reveal the policy for no benefit. */
export const loginRequestSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required').max(PASSWORD_MAX_LENGTH),
});

/** POST /auth/change-password */
export const changePasswordRequestSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required').max(PASSWORD_MAX_LENGTH),
    newPassword: newPasswordSchema,
  })
  .refine((body) => body.newPassword !== body.currentPassword, {
    path: ['newPassword'],
    message: 'New password must differ from the current one',
  });

/** The signed-in user as the web app sees it (GET /auth/me and every session response). */
export const authUserSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  role: z.enum(ROLES),
  organization: z
    .object({ id: z.uuid(), name: z.string(), slug: z.string(), timezone: z.string() })
    .nullable(),
  mustChangePassword: z.boolean(),
  permissions: z.array(z.enum(PERMISSIONS)),
});

/** Returned by login, refresh and change-password. The refresh token travels only in a cookie. */
export const authSessionResponseSchema = z.object({
  accessToken: z.string(),
  /** Seconds until the access token expires. */
  expiresIn: z.number().int().positive(),
  user: authUserSchema,
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>;
export type AuthUser = z.infer<typeof authUserSchema>;
export type AuthSessionResponse = z.infer<typeof authSessionResponseSchema>;
