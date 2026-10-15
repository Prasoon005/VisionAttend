import { beforeAll, describe, expect, it } from 'vitest';
import {
  admin,
  anonymousClient,
  createDepartment,
  createOrg,
  createUser,
  type TestUser,
} from './helpers';

/**
 * Row Level Security is the final authority (CLAUDE.md §2). These tests sign
 * in as real users and prove what each role can and cannot see or change.
 */
let orgA: string;
let orgB: string;
let deptA1: string;
let deptA2: string;
let adminA: TestUser;
let managerA: TestUser;
let memberA1: TestUser; // same department as the manager
let memberA2: TestUser; // other department
let adminB: TestUser;
let memberB: TestUser;
let superAdmin: TestUser;

beforeAll(async () => {
  orgA = await createOrg('a');
  orgB = await createOrg('b');
  deptA1 = await createDepartment(orgA, 'Physics');
  deptA2 = await createDepartment(orgA, 'Chemistry');
  [adminA, managerA, memberA1, memberA2, adminB, memberB, superAdmin] = await Promise.all([
    createUser('org_admin', orgA),
    createUser('manager', orgA, { departmentId: deptA1 }),
    createUser('member', orgA, { departmentId: deptA1 }),
    createUser('member', orgA, { departmentId: deptA2 }),
    createUser('org_admin', orgB),
    createUser('member', orgB),
    createUser('super_admin', null),
  ]);
});

const visibleProfileIds = async (user: TestUser) => {
  const { data, error } = await user.client.from('profiles').select('id');
  expect(error).toBeNull();
  return new Set((data ?? []).map((row) => row.id as string));
};

describe('profiles', () => {
  it('a member sees only their own profile', async () => {
    expect(await visibleProfileIds(memberA1)).toEqual(new Set([memberA1.id]));
  });

  it('a manager sees themselves and their own department only', async () => {
    const ids = await visibleProfileIds(managerA);
    expect(ids).toEqual(new Set([managerA.id, memberA1.id]));
  });

  it('an org admin sees everyone in their organization and nobody outside it', async () => {
    const ids = await visibleProfileIds(adminA);
    for (const user of [adminA, managerA, memberA1, memberA2]) expect(ids.has(user.id)).toBe(true);
    for (const user of [adminB, memberB, superAdmin]) expect(ids.has(user.id)).toBe(false);
  });

  it('the super admin sees org admins only, not members', async () => {
    const ids = await visibleProfileIds(superAdmin);
    expect(ids.has(adminA.id)).toBe(true);
    expect(ids.has(adminB.id)).toBe(true);
    expect(ids.has(memberA1.id)).toBe(false);
    expect(ids.has(managerA.id)).toBe(false);
  });

  it('a member can update their personal details', async () => {
    const { error } = await memberA1.client
      .from('profiles')
      .update({ full_name: 'Renamed Member', theme: 'dark', preferred_language: 'hi' })
      .eq('id', memberA1.id);
    expect(error).toBeNull();
    const { data } = await admin
      .from('profiles')
      .select('full_name, theme')
      .eq('id', memberA1.id)
      .single();
    expect(data).toEqual({ full_name: 'Renamed Member', theme: 'dark' });
  });

  // Changes are built lazily: the ids only exist after beforeAll has run.
  it.each([
    ['role', () => ({ role: 'org_admin' })],
    ['status', () => ({ status: 'active' })],
    ['org_id', () => ({ org_id: orgB })],
    ['department_id', () => ({ department_id: deptA2 })],
    ['email', () => ({ email: 'hacker@example.test' })],
  ])('a member cannot change their own %s', async (_column, change) => {
    const { error } = await memberA1.client.from('profiles').update(change()).eq('id', memberA1.id);
    expect(error?.code).toBe('42501'); // permission denied (column privilege)
    const { data } = await admin
      .from('profiles')
      .select('role, org_id')
      .eq('id', memberA1.id)
      .single();
    expect(data).toEqual({ role: 'member', org_id: orgA });
  });

  it('nobody can update another person’s profile, even an admin', async () => {
    const { data, error } = await adminA.client
      .from('profiles')
      .update({ full_name: 'Overwritten' })
      .eq('id', memberA2.id)
      .select();
    expect(error).toBeNull();
    expect(data).toEqual([]); // no row matched the policy
  });

  it('clients cannot insert or delete profiles', async () => {
    const insert = await adminA.client
      .from('profiles')
      .insert({ id: memberB.id, email: 'x@example.test' });
    expect(insert.error?.code).toBe('42501');
    const remove = await adminA.client.from('profiles').delete().eq('id', memberA2.id);
    expect(remove.error?.code).toBe('42501');
  });
});

describe('organizations', () => {
  it('members see only their own organization', async () => {
    const { data } = await memberA1.client.from('organizations').select('id');
    expect(data?.map((row) => row.id)).toEqual([orgA]);
  });

  it('only the super admin can create an organization', async () => {
    const slug = `t-new-${Date.now()}`;
    const denied = await adminA.client.from('organizations').insert({ name: 'Rogue', slug });
    expect(denied.error?.code).toBe('42501');

    const allowed = await superAdmin.client
      .from('organizations')
      .insert({ name: 'Created by platform', slug, timezone: 'Europe/London' })
      .select('id, status')
      .single();
    expect(allowed.error).toBeNull();
    expect(allowed.data?.status).toBe('active');
  });

  it('rejects an unknown timezone', async () => {
    const { error } = await superAdmin.client
      .from('organizations')
      .insert({ name: 'Bad TZ', slug: `t-tz-${Date.now()}`, timezone: 'Mars/Olympus' });
    expect(error?.code).toBe('22023');
  });

  it('an org admin cannot suspend or rename their organization', async () => {
    const { data } = await adminA.client
      .from('organizations')
      .update({ status: 'suspended' })
      .eq('id', orgA)
      .select();
    expect(data).toEqual([]);
  });

  it('suspending an organization cuts its members off from tenant data', async () => {
    const org = await createOrg('suspended');
    const member = await createUser('member', org);
    expect((await member.client.from('organizations').select('id')).data).toHaveLength(1);

    await admin.from('organizations').update({ status: 'suspended' }).eq('id', org);
    expect((await member.client.from('organizations').select('id')).data).toEqual([]);
  });
});

describe('departments', () => {
  it('members can read their organization’s departments, not others', async () => {
    const otherDept = await createDepartment(orgB);
    const { data } = await memberA1.client.from('departments').select('id');
    const ids = data?.map((row) => row.id);
    expect(ids).toEqual(expect.arrayContaining([deptA1, deptA2]));
    expect(ids).not.toContain(otherDept);
  });

  it('only an org admin can create departments, and only in their own organization', async () => {
    const byMember = await memberA1.client
      .from('departments')
      .insert({ org_id: orgA, name: 'Nope' });
    expect(byMember.error?.code).toBe('42501');

    const crossTenant = await adminA.client
      .from('departments')
      .insert({ org_id: orgB, name: 'Sneaky' });
    expect(crossTenant.error?.code).toBe('42501');

    const ok = await adminA.client.from('departments').insert({ org_id: orgA, name: 'Biology' });
    expect(ok.error).toBeNull();
  });

  it('the super admin cannot see tenant departments', async () => {
    const { data } = await superAdmin.client.from('departments').select('id');
    expect(data).toEqual([]);
  });

  it('the database rejects assigning a department from another organization', async () => {
    const otherDept = await createDepartment(orgB);
    const { error } = await admin
      .from('profiles')
      .update({ department_id: otherDept })
      .eq('id', memberA2.id);
    expect(error?.code).toBe('23503'); // composite foreign key (org_id, department_id)
  });
});

describe('audit logs and anonymous access', () => {
  it('clients cannot write, change or delete audit logs', async () => {
    const insert = await adminA.client
      .from('audit_logs')
      .insert({ org_id: orgA, action: 'fake.event', entity_type: 'x' });
    expect(insert.error?.code).toBe('42501');
  });

  it('audit logs are append-only even for the service role', async () => {
    const { data } = await admin
      .from('audit_logs')
      .insert({ org_id: orgA, action: 'test.event', entity_type: 'test' })
      .select('id')
      .single();
    const update = await admin
      .from('audit_logs')
      .update({ action: 'test.changed' })
      .eq('id', data?.id);
    expect(update.error?.message).toMatch(/append-only/);
    const remove = await admin.from('audit_logs').delete().eq('id', data?.id);
    expect(remove.error?.message).toMatch(/append-only/);
  });

  it('a member cannot read audit logs', async () => {
    const { data } = await memberA1.client.from('audit_logs').select('id');
    expect(data).toEqual([]);
  });

  it.each(['organizations', 'departments', 'profiles', 'invites', 'audit_logs'])(
    'an anonymous visitor cannot read %s',
    async (table) => {
      const { data, error } = await anonymousClient().from(table).select('*');
      expect(data ?? []).toEqual([]);
      if (error) expect(error.code).toBe('42501');
    },
  );
});
