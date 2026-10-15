import {
  BarChart3,
  Languages,
  Mic,
  ScanFace,
  ShieldCheck,
  Tablet,
  type LucideIcon,
} from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Reveal, Stagger, StaggerItem } from '@/components/motion';
import { Card, CardContent } from '@/components/ui/card';
import type { Locale } from '@/i18n/locales';

const FEATURES: {
  key: 'face' | 'kiosk' | 'voice' | 'languages' | 'insights' | 'privacy';
  icon: LucideIcon;
}[] = [
  { key: 'face', icon: ScanFace },
  { key: 'kiosk', icon: Tablet },
  { key: 'voice', icon: Mic },
  { key: 'languages', icon: Languages },
  { key: 'insights', icon: BarChart3 },
  { key: 'privacy', icon: ShieldCheck },
];

export default async function HomePage({ params }: PageProps<'/[locale]'>) {
  const { locale } = await params;
  setRequestLocale(locale as Locale); // validated by the [locale] layout
  const t = await getTranslations('Home');

  return (
    <div className="space-y-12">
      <Reveal>
        <section className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-primary/12 via-accent/40 to-transparent px-6 py-12 sm:px-10 sm:py-16">
          <p className="text-sm font-semibold tracking-wide text-primary uppercase">
            {t('eyebrow')}
          </p>
          <h1 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight text-balance sm:text-5xl">
            {t('title')}
          </h1>
          <p className="mt-4 max-w-2xl text-base text-pretty text-muted-foreground sm:text-lg">
            {t('subtitle')}
          </p>
          <ScanFace
            aria-hidden
            className="pointer-events-none absolute -end-6 -bottom-6 size-48 text-primary/10 sm:size-64"
          />
        </section>
      </Reveal>

      <section aria-labelledby="features-title" className="space-y-4">
        <h2 id="features-title" className="text-xl font-semibold tracking-tight">
          {t('featuresTitle')}
        </h2>
        <Stagger delay={0.1} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ key, icon: Icon }) => (
            <StaggerItem key={key}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardContent className="space-y-3">
                  <div className="grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground">
                    <Icon aria-hidden className="size-5" />
                  </div>
                  <h3 className="font-semibold">{t(`features.${key}.title`)}</h3>
                  <p className="text-sm text-muted-foreground">{t(`features.${key}.body`)}</p>
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </Stagger>
      </section>
    </div>
  );
}
