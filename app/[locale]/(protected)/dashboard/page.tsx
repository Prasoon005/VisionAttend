import { Building2, IdCard, Users } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Reveal } from '@/components/motion';
import { Card, CardContent } from '@/components/ui/card';
import { ORG_ROLES } from '@/lib/auth/route-access';
import { requireRole } from '@/lib/auth/session';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Nav');
  return { title: t('dashboard') };
}

/** Member home. The full dashboard (today's status, streaks, summaries) arrives in Phase 5. */
export default async function DashboardPage() {
  const user = await requireRole(ORG_ROLES);
  const t = await getTranslations('Dashboard');
  const tRoles = await getTranslations('Roles');

  const facts = [
    { icon: Building2, label: t('organization'), value: user.orgName ?? '—' },
    { icon: IdCard, label: t('role'), value: tRoles(user.role) },
    { icon: Users, label: t('department'), value: user.departmentName ?? t('noDepartment') },
  ];

  return (
    <div className="space-y-6">
      <Reveal>
        <h1 className="text-3xl font-bold tracking-tight">
          {t('title', { name: user.fullName || user.email })}
        </h1>
        <p className="mt-1 text-muted-foreground">{t('subtitle')}</p>
      </Reveal>
      <dl className="grid gap-4 sm:grid-cols-3">
        {facts.map(({ icon: Icon, label, value }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground">
                <Icon aria-hidden className="size-5" />
              </div>
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="truncate font-medium">{value}</dd>
              </div>
            </CardContent>
          </Card>
        ))}
      </dl>
    </div>
  );
}
