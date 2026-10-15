import type { Metadata, Viewport } from 'next';
import { Geist, Noto_Sans_Devanagari } from 'next/font/google';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Providers } from '@/components/providers';
import { AppShell } from '@/components/shell/app-shell';
import { directionOf } from '@/i18n/locales';
import { routing } from '@/i18n/routing';
import '../globals.css';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist', display: 'swap' });
const devanagari = Noto_Sans_Devanagari({
  subsets: ['devanagari'],
  variable: '--font-devanagari',
  display: 'swap',
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<'/[locale]'>): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: 'Metadata' });
  return {
    title: { default: t('title'), template: `%s · ${t('title')}` },
    description: t('description'),
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover', // lets the bottom bar extend under the iOS home indicator
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fcfcfd' },
    { media: '(prefers-color-scheme: dark)', color: '#101119' },
  ],
};

/** Root layout: one per locale, so <html lang> and dir are always correct. */
export default async function LocaleLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const dir = directionOf(locale);

  return (
    // next-themes adds class="dark" before hydration; suppress that one expected mismatch.
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <body className={`${geist.variable} ${devanagari.variable}`}>
        <NextIntlClientProvider>
          <Providers dir={dir}>
            <AppShell>{children}</AppShell>
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
