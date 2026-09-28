import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { changePasswordRequestSchema, PASSWORD_MIN_LENGTH } from '@visionattend/shared';
import { Alert, Button, Card, fieldErrors, PageHeader, TextField } from '../../components/ui';
import { toApiError } from '../../lib/api/client';
import { changePassword } from './api';
import { useAuth } from './AuthProvider';

export function ChangePasswordPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const update = (field: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const parsed = changePasswordRequestSchema.safeParse(form);
    const nextErrors = parsed.success
      ? {}
      : fieldErrors(
          parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        );
    if (form.confirm !== form.newPassword) nextErrors.confirm = 'Passwords do not match';
    setErrors(nextErrors);
    if (!parsed.success || nextErrors.confirm) return;

    setSubmitting(true);
    try {
      await changePassword(parsed.data);
      navigate('/', { replace: true });
    } catch (err) {
      const apiError = toApiError(err);
      if (apiError.code === 'INVALID_CURRENT_PASSWORD') {
        setErrors({ currentPassword: apiError.message });
      } else {
        setFormError(apiError.message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <PageHeader
        title="Change password"
        description={
          user?.mustChangePassword
            ? 'You signed in with a one-time password. Choose your own password to continue.'
            : 'Changing your password signs you out on all other devices.'
        }
      />
      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {formError && <Alert>{formError}</Alert>}
          <TextField
            id="currentPassword"
            label={user?.mustChangePassword ? 'One-time password' : 'Current password'}
            type="password"
            autoComplete="current-password"
            value={form.currentPassword}
            onChange={update('currentPassword')}
            error={errors.currentPassword}
          />
          <TextField
            id="newPassword"
            label="New password"
            type="password"
            autoComplete="new-password"
            hint={`At least ${PASSWORD_MIN_LENGTH} characters. A passphrase is easiest to remember.`}
            value={form.newPassword}
            onChange={update('newPassword')}
            error={errors.newPassword}
          />
          <TextField
            id="confirm"
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            value={form.confirm}
            onChange={update('confirm')}
            error={errors.confirm}
          />
          <Button type="submit" loading={submitting} className="w-full">
            Update password
          </Button>
        </form>
      </Card>
    </div>
  );
}
