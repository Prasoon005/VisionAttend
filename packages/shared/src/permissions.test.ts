import { describe, expect, it } from 'vitest';
import { PERMISSIONS, ROLE_PERMISSIONS, hasPermission } from './permissions.js';
import { ROLES } from './roles.js';

describe('RBAC permission map', () => {
  it('defines permissions for every role', () => {
    for (const role of ROLES) {
      expect(ROLE_PERMISSIONS[role]).toBeDefined();
    }
  });

  it('only references permissions from the catalog', () => {
    for (const role of ROLES) {
      for (const permission of ROLE_PERMISSIONS[role]) {
        expect(PERMISSIONS).toContain(permission);
      }
    }
  });

  it('keeps employees away from administrative permissions', () => {
    expect(hasPermission('EMPLOYEE', 'employee:write')).toBe(false);
    expect(hasPermission('EMPLOYEE', 'biometric:enroll')).toBe(false);
    expect(hasPermission('EMPLOYEE', 'attendance:read')).toBe(false);
    expect(hasPermission('EMPLOYEE', 'attendance:read:own')).toBe(true);
  });

  it('keeps the super admin away from tenant workforce data', () => {
    expect(hasPermission('SUPER_ADMIN', 'employee:read')).toBe(false);
    expect(hasPermission('SUPER_ADMIN', 'biometric:enroll')).toBe(false);
    expect(hasPermission('SUPER_ADMIN', 'organization:manage')).toBe(true);
  });
});
