import { Building, MailPlus, Users } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Reveal } from '@/components/motion';
import { Card, CardContent } from '@/components/ui/card';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('AdminHome');
  return { title: t('title') };
}

/** Org Admin home. User management (1g) and the full console (Phase 6) build on it. */
export default async function AdminHomePage() {
  const user = await requireRole(['org_admin']);
  const t = await getTranslations('AdminHome');
  const supabase = await createClient();

  // Counts run as the admin: RLS limits every query to their own organization.
  const [members, invites, departments] = await Promise.all([
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')
      .is('deleted_at', null),
    supabase
      .from('invites')
      .select('id', { count: 'exact', head: true })
      .is('revoked_at', null)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString()),
    supabase.from('departments').select('id', { count: 'exact', head: true }),
  ]);

  const stats = [
    { icon: Users, label: t('activeMembers'), value: members.count ?? 0 },
    { icon: MailPlus, label: t('pendingInvites'), value: invites.count ?? 0 },
    { icon: Building, label: t('departments'), value: departments.count ?? 0 },
  ];

  return (
    <div className="space-y-6">
      <Reveal>
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('subtitle', { org: user.orgName ?? '' })}</p>
      </Reveal>
      <dl className="grid gap-4 sm:grid-cols-3">
        {stats.map(({ icon: Icon, label, value }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground">
                <Icon aria-hidden className="size-5" />
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
              </div>
            </CardContent>
          </Card>
        ))}
      </dl>
    </div>
  );
}
