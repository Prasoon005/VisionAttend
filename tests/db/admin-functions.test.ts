import { beforeEach, describe, expect, it } from 'vitest';
import {
  admin,
  anonymousClient,
  createDepartment,
  createOrg,
  createUser,
  type TestUser,
} from './helpers';

/** admin_* RPCs: the only way to change role, department or status. */
let org: string;
let otherOrg: string;
let dept: string;
let orgAdmin: TestUser;
let member: TestUser;
let outsider: TestUser;

beforeEach(async () => {
  org = await createOrg('fn');
  otherOrg = await createOrg('fn-other');
  dept = await createDepartment(org);
  [orgAdmin, member, outsider] = await Promise.all([
    createUser('org_admin', org),
    createUser('member', org),
    createUser('org_admin', otherOrg),
  ]);
});

const profileOf = async (id: string) =>
  (
    await admin
      .from('profiles')
      .select('role, department_id, status, deleted_at')
      .eq('id', id)
      .single()
  ).data;

describe('admin_update_member', () => {
  it('changes role and department and records the change', async () => {
    const { error } = await orgAdmin.client.rpc('admin_update_member', {
      p_member_id: member.id,
      p_role: 'manager',
      p_department_id: dept,
    });
    expect(error).toBeNull();
    expect(await profileOf(member.id)).toMatchObject({ role: 'manager', department_id: dept });

    const { data: entry } = await admin
      .from('audit_logs')
      .select('action, actor_id, metadata')
      .eq('entity_id', member.id)
      .eq('action', 'member.updated')
      .single();
    expect(entry?.actor_id).toBe(orgAdmin.id);
    expect(entry?.metadata).toMatchObject({ role: { from: 'member', to: 'manager' } });
  });

  it('is refused for members', async () => {
    const { error } = await member.client.rpc('admin_update_member', {
      p_member_id: member.id,
      p_role: 'org_admin',
    });
    expect(error?.code).toBe('42501');
    expect((await profileOf(member.id))?.role).toBe('member');
  });

  it('treats another organization’s member as not found', async () => {
    const { error } = await outsider.client.rpc('admin_update_member', {
      p_member_id: member.id,
      p_role: 'manager',
    });
    expect(error?.code).toBe('P0002');
  });

  it('cannot assign super_admin or change the caller’s own role', async () => {
    const promote = await orgAdmin.client.rpc('admin_update_member', {
      p_member_id: member.id,
      p_role: 'super_admin',
    });
    expect(promote.error?.code).toBe('42501');

    const self = await orgAdmin.client.rpc('admin_update_member', {
      p_member_id: orgAdmin.id,
      p_role: 'member',
    });
    expect(self.error?.code).toBe('42501');
  });

  it('cannot demote the last active admin', async () => {
    const secondAdmin = await createUser('org_admin', org);
    // Demoting one of two admins is fine…
    expect(
      (
        await orgAdmin.client.rpc('admin_update_member', {
          p_member_id: secondAdmin.id,
          p_role: 'member',
        })
      ).error,
    ).toBeNull();
    // …but the database refuses to leave the organization without an admin.
    const last = await secondAdmin.client.rpc('admin_update_member', {
      p_member_id: orgAdmin.id,
      p_role: 'member',
    });
    expect(last.error).not.toBeNull();
    expect((await profileOf(orgAdmin.id))?.role).toBe('org_admin');
  });

  it('rejects a department from another organization', async () => {
    const foreignDept = await createDepartment(otherOrg);
    const { error } = await orgAdmin.client.rpc('admin_update_member', {
      p_member_id: member.id,
      p_department_id: foreignDept,
    });
    expect(error?.code).toBe('23503');
  });
});

describe('admin_set_member_status and admin_delete_member', () => {
  it('deactivating a member removes their access immediately', async () => {
    expect((await member.client.from('organizations').select('id')).data).toHaveLength(1);

    const { error } = await orgAdmin.client.rpc('admin_set_member_status', {
      p_member_id: member.id,
      p_status: 'deactivated',
    });
    expect(error).toBeNull();
    // Their still-valid token no longer reaches tenant data.
    expect((await member.client.from('organizations').select('id')).data).toEqual([]);

    await orgAdmin.client.rpc('admin_set_member_status', {
      p_member_id: member.id,
      p_status: 'active',
    });
    expect((await member.client.from('organizations').select('id')).data).toHaveLength(1);
  });

  it('an admin cannot deactivate or delete themselves', async () => {
    const deactivate = await orgAdmin.client.rpc('admin_set_member_status', {
      p_member_id: orgAdmin.id,
      p_status: 'deactivated',
    });
    expect(deactivate.error?.code).toBe('42501');
    const remove = await orgAdmin.client.rpc('admin_delete_member', { p_member_id: orgAdmin.id });
    expect(remove.error?.code).toBe('42501');
  });

  it('soft-deletes a member and audits it', async () => {
    expect(
      (await orgAdmin.client.rpc('admin_delete_member', { p_member_id: member.id })).error,
    ).toBeNull();
    const profile = await profileOf(member.id);
    expect(profile?.status).toBe('deactivated');
    expect(profile?.deleted_at).not.toBeNull();

    const { data } = await admin
      .from('audit_logs')
      .select('action')
      .eq('entity_id', member.id)
      .eq('action', 'member.deleted');
    expect(data).toHaveLength(1);

    // A deleted member can no longer be updated by admins.
    const again = await orgAdmin.client.rpc('admin_update_member', {
      p_member_id: member.id,
      p_role: 'manager',
    });
    expect(again.error?.code).toBe('P0002');
  });

  it('anonymous visitors cannot call admin functions', async () => {
    const { error } = await anonymousClient().rpc('admin_delete_member', {
      p_member_id: member.id,
    });
    expect(error).not.toBeNull();
    expect((await profileOf(member.id))?.deleted_at).toBeNull();
  });
});
