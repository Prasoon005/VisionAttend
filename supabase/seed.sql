-- ═══════════════════════════════════════════════════════════════════════════
-- Local development seed (applied by `npx supabase db reset`).
--
-- Fictional data only (*.test is a reserved domain). Never seed real people.
-- Every demo account uses the local-only password: Demo@12345
-- (documented in docs/SETUP.md; it exists only in local and CI databases).
-- ═══════════════════════════════════════════════════════════════════════════

insert into public.organizations (id, name, slug, timezone)
values ('00000000-0000-4000-a000-000000000001', 'Demo College', 'demo-college', 'Asia/Kolkata');

insert into public.departments (id, org_id, name) values
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-000000000001', 'Computer Science'),
  ('00000000-0000-4000-b000-000000000002', '00000000-0000-4000-a000-000000000001', 'Mechanical Engineering'),
  ('00000000-0000-4000-b000-000000000003', '00000000-0000-4000-a000-000000000001', 'Administration');

-- Users are inserted with app_metadata.bootstrap_role, the trusted path the
-- auth.users trigger accepts without an invitation; it creates each profile.
with demo (id, email, full_name, role, org_id) as (
  values
    ('00000000-0000-4000-c000-000000000001'::uuid, 'superadmin@visionattend.test', 'Platform Admin', 'super_admin', null),
    ('00000000-0000-4000-c000-000000000002'::uuid, 'admin@demo-college.test',      'Asha Verma',     'org_admin',   '00000000-0000-4000-a000-000000000001'),
    ('00000000-0000-4000-c000-000000000003'::uuid, 'manager@demo-college.test',    'Ravi Kumar',     'manager',     '00000000-0000-4000-a000-000000000001'),
    ('00000000-0000-4000-c000-000000000004'::uuid, 'member@demo-college.test',     'Meera Iyer',     'member',      '00000000-0000-4000-a000-000000000001'),
    ('00000000-0000-4000-c000-000000000005'::uuid, 'member2@demo-college.test',    'Karan Singh',    'member',      '00000000-0000-4000-a000-000000000001')
),
inserted as (
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  )
  select
    '00000000-0000-0000-0000-000000000000', d.id, 'authenticated', 'authenticated', d.email,
    extensions.crypt('Demo@12345', extensions.gen_salt('bf')), now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'),
                       'bootstrap_role', d.role, 'bootstrap_org_id', d.org_id),
    jsonb_build_object('full_name', d.full_name), now(), now(),
    '', '', '', '', '', '', '', ''
  from demo d
  returning id, email
)
insert into auth.identities (id, user_id, provider_id, provider, identity_data,
                             last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), i.id, i.id::text, 'email',
       jsonb_build_object('sub', i.id::text, 'email', i.email, 'email_verified', true),
       now(), now(), now()
from inserted i;

-- Department assignments (manager and first member share Computer Science).
update public.profiles set department_id = '00000000-0000-4000-b000-000000000001'
where id in ('00000000-0000-4000-c000-000000000003', '00000000-0000-4000-c000-000000000004');
update public.profiles set department_id = '00000000-0000-4000-b000-000000000002'
where id = '00000000-0000-4000-c000-000000000005';
