import { ScanFace } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { loginRequestSchema } from '@visionattend/shared';
import { Alert, Button, Card, TextField } from '../../components/ui';
import { toApiError } from '../../lib/api/client';
import { login } from './api';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const parsed = loginRequestSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError('Enter a valid email address and your password.');
      return;
    }
    setSubmitting(true);
    try {
      await login(parsed.data);
      // RedirectIfAuthenticated takes over once the session is set.
    } catch (err) {
      const apiError = toApiError(err);
      setError(
        apiError.code === 'RATE_LIMITED'
          ? 'Too many sign-in attempts. Please wait a few minutes and try again.'
          : apiError.message,
      );
      setPassword('');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <ScanFace aria-hidden className="size-10 text-indigo-600 dark:text-indigo-400" />
          <h1 className="text-2xl font-semibold tracking-tight">Sign in to VisionAttend</h1>
        </div>
        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {error && <Alert>{error}</Alert>}
            <TextField
              id="email"
              label="Email"
              type="email"
              autoComplete="username"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <TextField
              id="password"
              label="Password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button type="submit" loading={submitting} className="w-full">
              Sign in
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
