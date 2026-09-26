/**
 * Platform roles. Must stay in sync with the `Role` enum in
 * apps/api/prisma/schema.prisma (checked by a unit test in the API).
 */
export const ROLES = ['SUPER_ADMIN', 'ORG_ADMIN', 'EMPLOYEE'] as const;

export type Role = (typeof ROLES)[number];
