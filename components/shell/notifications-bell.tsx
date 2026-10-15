'use client';

import { Bell, BellOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

/**
 * Notifications entry point. There is no notification source until the
 * notifications table and Realtime feed arrive (Phase 5), so it truthfully
 * shows the empty state.
 */
export function NotificationsBell() {
  const t = useTranslations('TopBar');

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t('notifications')}>
          <Bell aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <EmptyState
          icon={BellOff}
          title={t('notificationsEmptyTitle')}
          description={t('notificationsEmptyBody')}
        />
      </PopoverContent>
    </Popover>
  );
}
