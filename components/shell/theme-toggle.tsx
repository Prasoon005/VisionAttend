'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const THEMES = [
  { value: 'light', labelKey: 'themeLight', icon: Sun },
  { value: 'dark', labelKey: 'themeDark', icon: Moon },
  { value: 'system', labelKey: 'themeSystem', icon: Monitor },
] as const;

export function ThemeToggle() {
  const t = useTranslations('TopBar');
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t('theme')}>
          {/* Icons swap through CSS, so the server render never mismatches the client. */}
          <Sun
            aria-hidden
            className="scale-100 rotate-0 transition-transform dark:scale-0 dark:-rotate-90"
          />
          <Moon
            aria-hidden
            className="absolute scale-0 rotate-90 transition-transform dark:scale-100 dark:rotate-0"
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
          {THEMES.map(({ value, labelKey, icon: Icon }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              <Icon aria-hidden className="size-4" />
              {t(labelKey)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
