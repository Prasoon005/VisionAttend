import { Inbox } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';
import { EmptyState } from '@/components/empty-state';
import { Reveal } from '@/components/motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { FeedbackDemo } from '@/features/design-system/feedback-demo';
import { LanguagesTable } from '@/features/design-system/languages-table';
import type { Locale } from '@/i18n/locales';

const SWATCHES = [
  ['background', 'bg-background'],
  ['foreground', 'bg-foreground'],
  ['primary', 'bg-primary'],
  ['secondary', 'bg-secondary'],
  ['accent', 'bg-accent'],
  ['muted', 'bg-muted'],
  ['success', 'bg-success'],
  ['warning', 'bg-warning'],
  ['destructive', 'bg-destructive'],
  ['border', 'bg-border'],
] as const;

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/design-system'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'DesignSystem' });
  return { title: t('title') };
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/**
 * Living reference for the design system: every token and shared component
 * rendered with the current theme and language. Used for visual QA and E2E tests.
 */
export default async function DesignSystemPage({ params }: PageProps<'/[locale]/design-system'>) {
  const { locale } = await params;
  setRequestLocale(locale as Locale); // validated by the [locale] layout
  const t = await getTranslations('DesignSystem');

  return (
    <div className="space-y-6">
      <Reveal>
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('subtitle')}</p>
      </Reveal>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title={t('colors')}>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {SWATCHES.map(([name, className]) => (
              <li key={name} className="space-y-1.5">
                <div className={`${className} h-12 rounded-lg border`} />
                <p className="font-mono text-xs">{name}</p>
              </li>
            ))}
          </ul>
        </Section>

        <Section title={t('typography')}>
          <div className="space-y-2">
            <p className="text-3xl font-bold tracking-tight">{t('typeDisplay')}</p>
            <p className="text-xl font-semibold">{t('typeHeading')}</p>
            <p>{t('typeBody')}</p>
            <p className="text-sm text-muted-foreground">{t('typeMuted')}</p>
          </div>
        </Section>

        <Section title={t('buttons')}>
          <div className="flex flex-wrap gap-2">
            <Button>{t('buttonPrimary')}</Button>
            <Button variant="secondary">{t('buttonSecondary')}</Button>
            <Button variant="outline">{t('buttonOutline')}</Button>
            <Button variant="ghost">{t('buttonGhost')}</Button>
            <Button variant="destructive">{t('buttonDestructive')}</Button>
          </div>
        </Section>

        <Section title={t('badges')}>
          <div className="flex flex-wrap gap-2">
            <Badge variant="success">{t('badgeOnTime')}</Badge>
            <Badge variant="warning">{t('badgeLate')}</Badge>
            <Badge variant="destructive">{t('badgeAbsent')}</Badge>
          </div>
        </Section>

        <Section title={t('feedback')}>
          <FeedbackDemo />
        </Section>

        <Section title={t('loading')}>
          <div className="flex items-center gap-4" aria-hidden>
            <Skeleton className="size-12 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
        </Section>

        <Section title={t('emptyStates')}>
          <EmptyState icon={Inbox} title={t('emptyTitle')} description={t('emptyBody')} />
        </Section>

        <Section title={t('dataTable')}>
          <LanguagesTable />
        </Section>
      </div>
    </div>
  );
}
