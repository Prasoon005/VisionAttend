import { z } from 'zod';
import { emailSchema } from './auth.js';
import { paginationQuerySchema, paginatedSchema } from './pagination.js';

export const ORGANIZATION_STATUSES = ['ACTIVE', 'SUSPENDED'] as const;

function isValidTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** IANA timezone name such as "Asia/Kolkata"; it decides each organization's work dates. */
export const timezoneSchema = z
  .string()
  .trim()
  .min(1)
  .refine(isValidTimezone, 'Unknown IANA timezone');

/** Lower-case letters, digits and single hyphens, e.g. "acme-labs". */
export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lower-case letters, digits and hyphens')
  .min(3)
  .max(40);

export const organizationSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  timezone: z.string(),
  status: z.enum(ORGANIZATION_STATUSES),
  userCount: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
});

/** POST /platform/organizations — creates the organization and its first Org Admin. */
export const createOrganizationRequestSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: slugSchema,
  timezone: timezoneSchema,
  adminEmail: emailSchema,
});

export const createOrganizationResponseSchema = z.object({
  organization: organizationSchema,
  admin: z.object({ id: z.uuid(), email: z.string() }),
  /**
   * Shown exactly once to the Super Admin, who hands it to the Org Admin.
   * Only its hash is stored, and it must be changed at first login.
   */
  temporaryPassword: z.string(),
});

/** PATCH /platform/organizations/:id */
export const updateOrganizationRequestSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    timezone: timezoneSchema,
    status: z.enum(ORGANIZATION_STATUSES),
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'Provide at least one field to update');

export const listOrganizationsQuerySchema = paginationQuerySchema;
export const organizationListResponseSchema = paginatedSchema(organizationSchema);

export type OrganizationStatus = (typeof ORGANIZATION_STATUSES)[number];
export type Organization = z.infer<typeof organizationSchema>;
export type CreateOrganizationRequest = z.infer<typeof createOrganizationRequestSchema>;
export type CreateOrganizationResponse = z.infer<typeof createOrganizationResponseSchema>;
export type UpdateOrganizationRequest = z.infer<typeof updateOrganizationRequestSchema>;
export type OrganizationListResponse = z.infer<typeof organizationListResponseSchema>;
