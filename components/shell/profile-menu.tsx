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
import type { Role } from '@/lib/auth/route-access';

export interface ProfileSummary {
  fullName: string;
  email: string;
  role: Role;
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

/** Account menu: who is signed in, or a guest state with a link to sign in. */
export function ProfileMenu({ profile }: { profile: ProfileSummary | null }) {
  const t = useTranslations('TopBar');
  const tRoles = useTranslations('Roles');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label={t('profile')}>
          <Avatar className="size-8">
            <AvatarFallback className="text-xs font-medium">
              {profile && initials(profile.fullName) ? (
                initials(profile.fullName)
              ) : (
                <UserRound aria-hidden className="size-4" />
              )}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {profile ? (
          <DropdownMenuLabel>
            <p className="truncate font-medium">{profile.fullName || profile.email}</p>
            <p className="truncate text-xs font-normal text-muted-foreground">{profile.email}</p>
            <p className="mt-1 text-xs font-normal text-primary">{tRoles(profile.role)}</p>
          </DropdownMenuLabel>
        ) : (
          <>
            <DropdownMenuLabel>
              <p className="font-medium">{t('guest')}</p>
              <p className="text-xs font-normal text-muted-foreground">{t('signedOut')}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>
              <LogIn aria-hidden className="size-4" />
              {t('signIn')}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
