import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { createDepartmentRequestSchema, type Department } from '@visionattend/shared';
import { Alert, Button, Card, fieldErrors, PageHeader, TextField } from '../../components/ui';
import { ApiError, toApiError } from '../../lib/api/client';
import {
  useCreateDepartment,
  useDeleteDepartment,
  useDepartments,
  useUpdateDepartment,
} from './api';

export function DepartmentsPage() {
  const departments = useDepartments();
  // null = closed, 'new' = create form, otherwise the department being edited.
  const [editing, setEditing] = useState<Department | 'new' | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeader title="Departments" description="Group employees for reporting and filters." />
        {editing === null && (
          <Button onClick={() => setEditing('new')}>
            <Plus aria-hidden className="size-4" /> New department
          </Button>
        )}
      </div>

      {editing !== null && (
        <DepartmentForm
          key={editing === 'new' ? 'new' : editing.id}
          department={editing === 'new' ? null : editing}
          onDone={() => setEditing(null)}
        />
      )}

      {departments.error && <Alert>{departments.error.message}</Alert>}

      <Card className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-800">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Code</th>
              <th className="px-4 py-3 font-medium">Employees</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {departments.isPending && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                  Loading…
                </td>
              </tr>
            )}
            {departments.data?.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                  No departments yet.
                </td>
              </tr>
            )}
            {departments.data?.map((department) => (
              <DepartmentRow
                key={department.id}
                department={department}
                onEdit={() => setEditing(department)}
              />
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function DepartmentRow({ department, onEdit }: { department: Department; onEdit: () => void }) {
  const remove = useDeleteDepartment();

  function handleDelete() {
    if (window.confirm(`Delete the ${department.name} department?`)) remove.mutate(department.id);
  }

  return (
    <tr>
      <td className="px-4 py-3 font-medium">{department.name}</td>
      <td className="px-4 py-3 font-mono text-xs">{department.code ?? '—'}</td>
      <td className="px-4 py-3">{department.employeeCount}</td>
      <td className="px-4 py-3 text-right">
        <div className="inline-flex gap-2">
          <Button variant="secondary" onClick={onEdit} aria-label={`Edit ${department.name}`}>
            <Pencil aria-hidden className="size-4" />
          </Button>
          <Button
            variant="secondary"
            loading={remove.isPending}
            onClick={handleDelete}
            aria-label={`Delete ${department.name}`}
          >
            <Trash2 aria-hidden className="size-4" />
          </Button>
        </div>
        {remove.error && <p className="mt-1 text-xs text-rose-600">{remove.error.message}</p>}
      </td>
    </tr>
  );
}

function DepartmentForm({
  department,
  onDone,
}: {
  department: Department | null;
  onDone: () => void;
}) {
  const create = useCreateDepartment();
  const update = useUpdateDepartment();
  const mutation = department ? update : create;
  const [form, setForm] = useState({ name: department?.name ?? '', code: department?.code ?? '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = createDepartmentRequestSchema.safeParse(form);
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
      if (department) await update.mutateAsync({ id: department.id, ...parsed.data });
      else await create.mutateAsync(parsed.data);
      onDone();
    } catch (error) {
      if (error instanceof ApiError && error.code === 'VALIDATION_ERROR') {
        setErrors(fieldErrors(error.details));
      }
    }
  }

  const apiError = mutation.error && toApiError(mutation.error);
  return (
    <Card className="p-6">
      <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <h2 className="text-lg font-semibold sm:col-span-2">
          {department ? `Edit ${department.name}` : 'New department'}
        </h2>
        {apiError && apiError.code !== 'VALIDATION_ERROR' && (
          <div className="sm:col-span-2">
            <Alert>
              {apiError.code === 'CONFLICT'
                ? 'A department with that name already exists.'
                : apiError.message}
            </Alert>
          </div>
        )}
        <TextField
          id="department-name"
          label="Name"
          value={form.name}
          error={errors.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
        />
        <TextField
          id="department-code"
          label="Code (optional)"
          hint="Short label such as ENG or HR."
          value={form.code}
          error={errors.code}
          onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))}
        />
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button type="button" variant="secondary" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            {department ? 'Save changes' : 'Create department'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
