'use client';

import { MotionConfig } from 'motion/react';
import { ThemeProvider } from 'next-themes';
import { Direction } from 'radix-ui';
import type { ReactNode } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { Direction as TextDirection } from '@/i18n/locales';

/** Client-side context shared by every page. */
export function Providers({ children, dir }: { children: ReactNode; dir: TextDirection }) {
  return (
    // `class` strategy: next-themes sets <html class="dark"> before paint, so no flash.
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {/* Radix menus/popovers position themselves correctly for right-to-left languages. */}
      <Direction.Provider dir={dir}>
        <MotionConfig reducedMotion="user">
          <TooltipProvider delayDuration={300}>
            {children}
            <Toaster position="top-center" richColors closeButton />
          </TooltipProvider>
        </MotionConfig>
      </Direction.Provider>
    </ThemeProvider>
  );
}
