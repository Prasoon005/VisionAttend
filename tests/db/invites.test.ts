import { beforeAll, describe, expect, it } from 'vitest';
import {
  admin,
  createDepartment,
  createInvite,
  createOrg,
  createUser,
  hashToken,
  randomEmail,
  signUpWithInvite,
  type TestUser,
} from './helpers';

/** Sign-up is invite-only, enforced by the auth.users trigger. */
let orgA: string;
let orgB: string;
let deptA: string;
let adminA: TestUser;
let memberA: TestUser;
let superAdmin: TestUser;

beforeAll(async () => {
  orgA = await createOrg('inv-a');
  orgB = await createOrg('inv-b');
  deptA = await createDepartment(orgA);
  [adminA, memberA, superAdmin] = await Promise.all([
    createUser('org_admin', orgA),
    createUser('member', orgA),
    createUser('super_admin', null),
  ]);
});

const usesOf = async (id: string) =>
  (await admin.from('invites').select('uses').eq('id', id).single()).data?.uses as number;

describe('sign-up through invitations', () => {
  it('refuses to create an account without an invitation', async () => {
    const { error } = await admin.auth.admin.createUser({
      email: randomEmail('uninvited'),
      password: 'Passw0rd-xyz',
      email_confirm: true,
    });
    expect(error).not.toBeNull();
  });

  it('creates the profile from the invitation and consumes it', async () => {
    const email = randomEmail('invited');
    const invite = await createInvite({ orgId: orgA, role: 'manager', email, departmentId: deptA });

    const { data, error } = await signUpWithInvite(email, invite.token);
    expect(error).toBeNull();

    const { data: profile } = await admin
      .from('profiles')
      .select('org_id, role, department_id, full_name, email')
      .eq('id', data.user?.id)
      .single();
    expect(profile).toEqual({
      org_id: orgA,
      role: 'manager',
      department_id: deptA,
      full_name: 'Invited Person',
      email,
    });
    expect(await usesOf(invite.id)).toBe(1);
  });

  it('does not keep the plaintext token in the user’s metadata', async () => {
    const email = randomEmail('clean');
    const invite = await createInvite({ orgId: orgA, role: 'member', email });
    const { data } = await signUpWithInvite(email, invite.token);
    const { data: user } = await admin.auth.admin.getUserById(data.user!.id);
    expect(user.user?.user_metadata).not.toHaveProperty('invite_token');
    expect(user.user?.app_metadata.invite_id).toBe(invite.id);
  });

  it('writes a member.created audit entry for the organization', async () => {
    const email = randomEmail('audited');
    const invite = await createInvite({ orgId: orgA, role: 'member', email });
    const { data } = await signUpWithInvite(email, invite.token);
    const { data: entries } = await admin
      .from('audit_logs')
      .select('org_id, action')
      .eq('entity_id', data.user!.id);
    expect(entries).toEqual([{ org_id: orgA, action: 'member.created' }]);
  });

  it.each([
    ['expired', { expiresAt: new Date(Date.now() - 1000) }],
    ['revoked', { revoked: true }],
  ])('rejects an %s invitation', async (_label, options) => {
    const email = randomEmail();
    const invite = await createInvite({ orgId: orgA, role: 'member', email, ...options });
    const { error } = await signUpWithInvite(email, invite.token);
    expect(error).not.toBeNull();
    expect(await usesOf(invite.id)).toBe(0);
  });

  it('rejects an email invitation used by a different address', async () => {
    const invite = await createInvite({
      orgId: orgA,
      role: 'member',
      email: randomEmail('intended'),
    });
    const { error } = await signUpWithInvite(randomEmail('someone-else'), invite.token);
    expect(error).not.toBeNull();
  });

  it('rejects a wrong token', async () => {
    const { error } = await signUpWithInvite(randomEmail(), 'not-a-real-token');
    expect(error).not.toBeNull();
  });

  it('lets a link invitation be used up to its limit, then stops', async () => {
    const invite = await createInvite({ orgId: orgA, role: 'member', maxUses: 2 });
    expect((await signUpWithInvite(randomEmail('link1'), invite.token)).error).toBeNull();
    expect((await signUpWithInvite(randomEmail('link2'), invite.token)).error).toBeNull();
    expect((await signUpWithInvite(randomEmail('link3'), invite.token)).error).not.toBeNull();
    expect(await usesOf(invite.id)).toBe(2);
  });

  it('rejects invitations to a suspended organization', async () => {
    const org = await createOrg('inv-suspended');
    const invite = await createInvite({ orgId: org, role: 'member' });
    await admin.from('organizations').update({ status: 'suspended' }).eq('id', org);
    expect((await signUpWithInvite(randomEmail(), invite.token)).error).not.toBeNull();
  });
});

describe('managing invitations', () => {
  const newInvite = (orgId: string, role = 'member') => ({
    org_id: orgId,
    role,
    token_hash: hashToken(crypto.randomUUID()),
    expires_at: new Date(Date.now() + 86_400_000).toISOString(),
  });

  it('an org admin can invite into their own organization only', async () => {
    expect((await adminA.client.from('invites').insert(newInvite(orgA))).error).toBeNull();
    expect((await adminA.client.from('invites').insert(newInvite(orgB))).error?.code).toBe('42501');
  });

  it('a member cannot create invitations', async () => {
    expect((await memberA.client.from('invites').insert(newInvite(orgA))).error?.code).toBe(
      '42501',
    );
  });

  it('nobody can invite a super admin', async () => {
    const { error } = await adminA.client.from('invites').insert(newInvite(orgA, 'super_admin'));
    expect(error).not.toBeNull();
  });

  it('the super admin can invite an organization’s first admin, but not members', async () => {
    const org = await createOrg('inv-platform');
    expect(
      (await superAdmin.client.from('invites').insert(newInvite(org, 'org_admin'))).error,
    ).toBeNull();
    expect(
      (await superAdmin.client.from('invites').insert(newInvite(org, 'member'))).error?.code,
    ).toBe('42501');
  });

  it('an org admin can revoke but not otherwise edit an invitation', async () => {
    const invite = await createInvite({ orgId: orgA, role: 'member' });
    const revoke = await adminA.client
      .from('invites')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', invite.id);
    expect(revoke.error).toBeNull();

    const upgrade = await adminA.client
      .from('invites')
      .update({ role: 'org_admin' })
      .eq('id', invite.id);
    expect(upgrade.error?.code).toBe('42501');
  });
});
