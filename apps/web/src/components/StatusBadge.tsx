import { CircleCheck, CircleX, LoaderCircle } from 'lucide-react';

type Status = 'up' | 'down' | 'loading';

const styles: Record<Status, string> = {
  up: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400',
  down: 'bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-500/10 dark:text-rose-400',
  loading: 'bg-slate-100 text-slate-600 ring-slate-500/20 dark:bg-slate-500/10 dark:text-slate-400',
};

const labels: Record<Status, string> = {
  up: 'Operational',
  down: 'Unavailable',
  loading: 'Checking',
};

export function StatusBadge({ status }: { status: Status }) {
  const Icon = status === 'up' ? CircleCheck : status === 'down' ? CircleX : LoaderCircle;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${styles[status]}`}
    >
      <Icon aria-hidden className={`size-3.5 ${status === 'loading' ? 'animate-spin' : ''}`} />
      {labels[status]}
    </span>
  );
}
