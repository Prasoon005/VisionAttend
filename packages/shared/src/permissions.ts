import type { Role } from './roles.js';

/**
 * Permission catalog.
 *
 * Routes are guarded by permissions, never by role names, so roles can later
 * move into the database (custom per-organization roles) without touching
 * any route. Format: `<resource>:<action>`; `:own` means "only my records".
 */
export const PERMISSIONS = [
  // Platform
  'organization:manage',
  'platform:health',
  // Organization administration
  'employee:read',
  'employee:write',
  'department:write',
  'shift:write',
  'holiday:write',
  'camera:read',
  'camera:write',
  'biometric:enroll',
  'biometric:delete',
  'attendance:read',
  'attendance:write',
  'correction:review',
  'leave:review',
  'report:read',
  'audit:read',
  // Self-service
  'attendance:read:own',
  'correction:create:own',
  'leave:create:own',
  'profile:read:own',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const SELF_SERVICE: readonly Permission[] = [
  'attendance:read:own',
  'correction:create:own',
  'leave:create:own',
  'profile:read:own',
];

/**
 * Super Admin deliberately has NO access to organization data
 * (employees, attendance, biometrics): the platform operator is not the
 * data controller of a tenant's workforce data.
 */
export const ROLE_PERMISSIONS: Readonly<Record<Role, readonly Permission[]>> = {
  SUPER_ADMIN: ['organization:manage', 'platform:health'],
  ORG_ADMIN: [
    'employee:read',
    'employee:write',
    'department:write',
    'shift:write',
    'holiday:write',
    'camera:read',
    'camera:write',
    'biometric:enroll',
    'biometric:delete',
    'attendance:read',
    'attendance:write',
    'correction:review',
    'leave:review',
    'report:read',
    'audit:read',
    ...SELF_SERVICE,
  ],
  EMPLOYEE: SELF_SERVICE,
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
