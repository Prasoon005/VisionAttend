import { Copy, KeyRound, Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import {
  createOrganizationRequestSchema,
  type CreateOrganizationResponse,
  type Organization,
} from '@visionattend/shared';
import {
  Alert,
  Button,
  Card,
  fieldErrors,
  PageHeader,
  SelectField,
  TextField,
} from '../../components/ui';
import { ApiError, toApiError } from '../../lib/api/client';
import { useCreateOrganization, useOrganizations, useUpdateOrganization } from './api';

const TIMEZONES = Intl.supportedValuesOf('timeZone');

const toSlug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

export function OrganizationsPage() {
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [created, setCreated] = useState<CreateOrganizationResponse | null>(null);
  const organizations = useOrganizations(page);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeader
          title="Organizations"
          description="Onboard tenants and control their access to the platform."
        />
        {!showForm && (
          <Button
            onClick={() => {
              setCreated(null);
              setShowForm(true);
            }}
          >
            <Plus aria-hidden className="size-4" /> New organization
          </Button>
        )}
      </div>

      {created && <OneTimePassword result={created} onDismiss={() => setCreated(null)} />}

      {showForm && (
        <CreateOrganizationForm
          onCancel={() => setShowForm(false)}
          onCreated={(result) => {
            setShowForm(false);
            setCreated(result);
          }}
        />
      )}

      {organizations.error && <Alert>{organizations.error.message}</Alert>}

      <Card className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-800">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Slug</th>
              <th className="px-4 py-3 font-medium">Timezone</th>
              <th className="px-4 py-3 font-medium">Users</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {organizations.isPending && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  Loading…
                </td>
              </tr>
            )}
            {organizations.data?.items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  No organizations yet.
                </td>
              </tr>
            )}
            {organizations.data?.items.map((org) => (
              <OrganizationRow key={org.id} org={org} />
            ))}
          </tbody>
        </table>
      </Card>

      {organizations.data && organizations.data.total > organizations.data.pageSize && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button variant="secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>
            Previous
          </Button>
          <Button
            variant="secondary"
            disabled={page * organizations.data.pageSize >= organizations.data.total}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

function OrganizationRow({ org }: { org: Organization }) {
  const update = useUpdateOrganization();
  const suspended = org.status === 'SUSPENDED';

  function toggleStatus() {
    if (
      !suspended &&
      !window.confirm(`Suspend ${org.name}? All of its users will be signed out.`)
    ) {
      return;
    }
    update.mutate({ id: org.id, status: suspended ? 'ACTIVE' : 'SUSPENDED' });
  }

  return (
    <tr>
      <td className="px-4 py-3 font-medium">{org.name}</td>
      <td className="px-4 py-3 font-mono text-xs">{org.slug}</td>
      <td className="px-4 py-3">{org.timezone}</td>
      <td className="px-4 py-3">{org.userCount}</td>
      <td className="px-4 py-3">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            suspended
              ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400'
              : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
          }`}
        >
          {suspended ? 'Suspended' : 'Active'}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <Button
          variant={suspended ? 'secondary' : 'danger'}
          loading={update.isPending}
          onClick={toggleStatus}
        >
          {suspended ? 'Reactivate' : 'Suspend'}
        </Button>
        {update.error && <p className="mt-1 text-xs text-rose-600">{update.error.message}</p>}
      </td>
    </tr>
  );
}

function CreateOrganizationForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: (result: CreateOrganizationResponse) => void;
}) {
  const create = useCreateOrganization();
  const [form, setForm] = useState({
    name: '',
    slug: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    adminEmail: '',
  });
  const [slugEdited, setSlugEdited] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = createOrganizationRequestSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(
        fieldErrors(
          parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        ),
      );
      return;
    }
    setErrors({});
    try {
      onCreated(await create.mutateAsync(parsed.data));
    } catch (error) {
      if (error instanceof ApiError && error.code === 'VALIDATION_ERROR') {
        setErrors(fieldErrors(error.details));
      }
    }
  }

  const apiError = create.error && toApiError(create.error);
  return (
    <Card className="p-6">
      <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <h2 className="text-lg font-semibold sm:col-span-2">New organization</h2>
        {apiError && apiError.code !== 'VALIDATION_ERROR' && (
          <div className="sm:col-span-2">
            <Alert>
              {apiError.code === 'CONFLICT'
                ? 'That slug or admin email is already in use.'
                : apiError.message}
            </Alert>
          </div>
        )}
        <TextField
          id="org-name"
          label="Name"
          value={form.name}
          error={errors.name}
          onChange={(e) =>
            setForm((prev) => ({
              ...prev,
              name: e.target.value,
              slug: slugEdited ? prev.slug : toSlug(e.target.value),
            }))
          }
        />
        <TextField
          id="org-slug"
          label="Slug"
          hint="Unique identifier: lower-case letters, digits and hyphens."
          value={form.slug}
          error={errors.slug}
          onChange={(e) => {
            setSlugEdited(true);
            setForm((prev) => ({ ...prev, slug: e.target.value }));
          }}
        />
        <SelectField
          id="org-timezone"
          label="Timezone"
          value={form.timezone}
          error={errors.timezone}
          onChange={(e) => setForm((prev) => ({ ...prev, timezone: e.target.value }))}
        >
          {TIMEZONES.map((tz) => (
            <option key={tz}>{tz}</option>
          ))}
        </SelectField>
        <TextField
          id="org-admin-email"
          label="First admin's email"
          type="email"
          hint="A one-time password is generated for this account."
          value={form.adminEmail}
          error={errors.adminEmail}
          onChange={(e) => setForm((prev) => ({ ...prev, adminEmail: e.target.value }))}
        />
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" loading={create.isPending}>
            Create organization
          </Button>
        </div>
      </form>
    </Card>
  );
}

function OneTimePassword({
  result,
  onDismiss,
}: {
  result: CreateOrganizationResponse;
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(result.temporaryPassword);
    setCopied(true);
  }

  return (
    <Card className="border-amber-300 bg-amber-50 p-6 dark:border-amber-500/40 dark:bg-amber-500/10">
      <div className="flex gap-3">
        <KeyRound aria-hidden className="mt-0.5 size-5 shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h2 className="font-semibold">{result.organization.name} created</h2>
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Give <strong>{result.admin.email}</strong> this one-time password over a secure
              channel. It is shown <strong>only once</strong> and must be changed at first sign-in.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded-md bg-white px-3 py-2 font-mono text-sm ring-1 ring-amber-300 dark:bg-slate-900 dark:ring-amber-500/40">
              {result.temporaryPassword}
            </code>
            <Button variant="secondary" onClick={copy}>
              <Copy aria-hidden className="size-4" /> {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <Button variant="secondary" onClick={onDismiss}>
            I have saved it
          </Button>
        </div>
      </div>
    </Card>
  );
}
