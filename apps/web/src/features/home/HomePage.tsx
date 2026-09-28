import { Building2, CalendarClock, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Alert, Button, Card, PageHeader } from '../../components/ui';
import { useAuditLogs } from '../audit/api';
import { useAuth, useCan } from '../auth/AuthProvider';

const ACTION_LABELS: Record<string, string> = {
  'auth.login': 'Signed in',
  'auth.login_failed': 'Failed sign-in',
  'auth.logout': 'Signed out',
  'auth.refresh_reuse': 'Session token reuse detected',
  'auth.password_changed': 'Password changed',
  'organization.create': 'Organization created',
  'organization.update': 'Organization updated',
};

/** Role-aware landing page. Sections appear only for users with the permission. */
export function HomePage() {
  const { user } = useAuth();
  const can = useCan();

  return (
    <div className="space-y-6">
      <PageHeader
        title={user?.organization ? user.organization.name : 'Platform administration'}
        description={`Signed in as ${user?.email ?? ''}`}
      />

      {can('organization:manage') && (
        <Card className="flex items-center gap-4 p-5">
          <Building2 aria-hidden className="size-6 text-indigo-600 dark:text-indigo-400" />
          <div className="flex-1">
            <p className="font-medium">Organizations</p>
            <p className="text-sm text-slate-500">Onboard tenants, suspend or reactivate them.</p>
          </div>
          <Link to="/platform/organizations" className="text-sm font-medium text-indigo-600">
            Manage →
          </Link>
        </Card>
      )}

      {can('attendance:read:own') && !can('audit:read') && (
        <Card className="flex items-center gap-4 p-5">
          <CalendarClock aria-hidden className="size-6 text-indigo-600 dark:text-indigo-400" />
          <div>
            <p className="font-medium">My attendance</p>
            <p className="text-sm text-slate-500">
              Your attendance history appears here once the attendance engine is live.
            </p>
          </div>
        </Card>
      )}

      {can('audit:read') && <RecentActivity />}
    </div>
  );
}

function RecentActivity() {
  const [page, setPage] = useState(1);
  const logs = useAuditLogs(page);

  return (
    <Card>
      <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
        <ShieldCheck aria-hidden className="size-5 text-indigo-600 dark:text-indigo-400" />
        <h2 className="font-semibold">Security activity</h2>
        <span className="text-sm text-slate-500">— your organization only</span>
      </div>
      {logs.error && (
        <div className="p-4">
          <Alert>{logs.error.message}</Alert>
        </div>
      )}
      <ul className="divide-y divide-slate-200 dark:divide-slate-800">
        {logs.data?.items.map((entry) => (
          <li
            key={entry.id}
            className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm"
          >
            <span className="font-medium">{ACTION_LABELS[entry.action] ?? entry.action}</span>
            <span className="text-slate-500">{entry.ip ?? 'unknown IP'}</span>
            <time className="ml-auto text-slate-500" dateTime={entry.createdAt}>
              {new Date(entry.createdAt).toLocaleString()}
            </time>
          </li>
        ))}
      </ul>
      {logs.data && logs.data.total > logs.data.pageSize && (
        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3 dark:border-slate-800">
          <Button variant="secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>
            Newer
          </Button>
          <Button
            variant="secondary"
            disabled={page * logs.data.pageSize >= logs.data.total}
            onClick={() => setPage(page + 1)}
          >
            Older
          </Button>
        </div>
      )}
    </Card>
  );
}
