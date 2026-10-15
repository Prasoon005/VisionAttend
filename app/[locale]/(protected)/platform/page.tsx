import { Building2 } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { EmptyState } from '@/components/empty-state';
import { Reveal } from '@/components/motion';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('PlatformHome');
  return { title: t('title') };
}

/** Super Admin home. Organization onboarding (slice 1f) builds on this page. */
export default async function PlatformHomePage() {
  await requireRole(['super_admin']);
  const t = await getTranslations('PlatformHome');
  const supabase = await createClient();

  const { data: organizations, count } = await supabase
    .from('organizations')
    .select('id, name, slug, status', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(5);

  return (
    <div className="space-y-6">
      <Reveal>
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('subtitle')}</p>
      </Reveal>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground">
              <Building2 aria-hidden className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('organizations')}</p>
              <p className="text-2xl font-semibold tabular-nums">{count ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t('recent')}</CardTitle>
          </CardHeader>
          <CardContent>
            {organizations && organizations.length > 0 ? (
              <ul className="divide-y">
                {organizations.map((org) => (
                  <li key={org.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{org.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">{org.slug}</p>
                    </div>
                    <Badge variant={org.status === 'active' ? 'success' : 'destructive'}>
                      {org.status === 'active' ? t('active') : t('suspended')}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={Building2} title={t('none')} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
