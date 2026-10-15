'use client';

import { LogIn, UserRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * Account menu. Authentication arrives in Phase 1, so everyone is a guest and
 * "Sign in" is shown disabled rather than linking to a page that doesn't exist.
 */
export function ProfileMenu() {
  const t = useTranslations('TopBar');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label={t('profile')}>
          <Avatar className="size-8">
            <AvatarFallback>
              <UserRound aria-hidden className="size-4" />
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <p className="font-medium">{t('guest')}</p>
          <p className="text-xs font-normal text-muted-foreground">{t('signedOut')}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <LogIn aria-hidden className="size-4" />
          {t('signIn')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
