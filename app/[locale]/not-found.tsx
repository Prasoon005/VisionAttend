import { MapPinOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

export default function NotFoundPage() {
  const t = useTranslations('NotFound');

  return (
    <EmptyState
      icon={MapPinOff}
      title={t('title')}
      description={t('body')}
      className="py-24"
      action={
        <Button asChild>
          <Link href="/">{t('backHome')}</Link>
        </Button>
      }
    />
  );
}
