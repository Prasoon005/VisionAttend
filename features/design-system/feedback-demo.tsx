'use client';

import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export function FeedbackDemo() {
  const t = useTranslations('DesignSystem');

  return (
    <div className="flex flex-wrap gap-2">
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline">{t('openDialog')}</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('dialogTitle')}</DialogTitle>
            <DialogDescription>{t('dialogBody')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button>{t('close')}</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Button variant="outline" onClick={() => toast.success(t('toastMessage'))}>
        {t('showToast')}
      </Button>
    </div>
  );
}
