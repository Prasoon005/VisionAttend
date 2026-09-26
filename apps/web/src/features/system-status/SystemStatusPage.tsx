import { Camera, Database, Server, Zap, type LucideIcon } from 'lucide-react';
import type { DependencyCheck } from '@visionattend/shared';
import { StatusBadge } from '../../components/StatusBadge';
import { useLiveness, useReadiness } from './api';

interface ServiceRow {
  name: string;
  description: string;
  icon: LucideIcon;
  check: DependencyCheck | undefined;
}

export function SystemStatusPage() {
  const liveness = useLiveness();
  const readiness = useReadiness();
  const checks = readiness.data?.checks;

  const rows: ServiceRow[] = [
    {
      name: 'Database',
      description: 'PostgreSQL system of record',
      icon: Database,
      check: checks?.database,
    },
    {
      name: 'Cache & events',
      description: 'Redis rate limits, cooldowns, event stream',
      icon: Zap,
      check: checks?.redis,
    },
    {
      name: 'Computer vision',
      description: 'Python CV service (internal)',
      icon: Camera,
      check: checks?.cvService,
    },
  ];

  const apiStatus = liveness.isPending ? 'loading' : liveness.isSuccess ? 'up' : 'down';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">System status</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Live health of every VisionAttend service. Refreshes every 10 seconds.
        </p>
      </div>

      <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
        <li className="flex items-center gap-4 p-4">
          <Server aria-hidden className="size-5 shrink-0 text-indigo-600 dark:text-indigo-400" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">API</p>
            <p className="truncate text-sm text-slate-500 dark:text-slate-400">
              {liveness.data
                ? `v${liveness.data.version} · up ${liveness.data.uptimeSeconds}s`
                : (liveness.error?.message ?? 'Node.js + Express')}
            </p>
          </div>
          <StatusBadge status={apiStatus} />
        </li>
        {rows.map(({ name, description, icon: Icon, check }) => (
          <li key={name} className="flex items-center gap-4 p-4">
            <Icon aria-hidden className="size-5 shrink-0 text-indigo-600 dark:text-indigo-400" />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{name}</p>
              <p className="truncate text-sm text-slate-500 dark:text-slate-400">
                {description}
                {check?.status === 'up' && ` · ${check.latencyMs} ms`}
              </p>
            </div>
            <StatusBadge status={check ? check.status : readiness.isPending ? 'loading' : 'down'} />
          </li>
        ))}
      </ul>
    </div>
  );
}
