import type messages from '../messages/en.json';
import type { routing } from './routing';

// Type-safe translation keys and locales: a typo in t('…') fails `npm run typecheck`.
declare module 'next-intl' {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof messages;
  }
}
