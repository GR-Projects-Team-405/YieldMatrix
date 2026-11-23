import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { isAxiosError } from 'axios';
import api, { TOKEN_KEY } from '../../services/api';
import AuthSplitLayout from './AuthSplitLayout';
import { ContentCard } from '../../components/ContentCard';
import { InputField } from '../../components/InputField';
import { Button } from '../../components/Button';
import { Alert } from '../../components/Alert';

function messageFor(error: unknown): string {
  if (isAxiosError(error) && error.response) {
    switch (error.response.status) {
      case 401:
        return 'Email or password is incorrect.';
      case 403:
        return 'Your account access is restricted. Contact the YieldMatrix team for help.';
      case 422:
        return 'Check your email and password and try again.';
      case 429:
        return 'Too many attempts. Try again later.';
    }
  }
  return 'Something went wrong. Please try again.';
}

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    const next: { email?: string; password?: string } = {};
    if (!email.trim()) next.email = 'Enter your email address.';
    else if (!/^\S+@\S+\.\S+$/.test(email.trim())) next.email = 'Enter a valid email address.';
    if (!password) next.password = 'Enter your password.';
    setErrors(next);
    setFormError('');
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    try {
      const { data } = await api.post<{ token: string }>('/ym02/login', { email: email.trim(), password });
      localStorage.setItem(TOKEN_KEY, data.token);
      // AuthProvider verifies the stored token with /auth/me when the app reloads,
      // so the shared AuthContext does not need to change.
      window.location.assign('/admin/overview');
    } catch (error) {
      setFormError(messageFor(error));
      setSubmitting(false);
    }
  }

    return (
    <AuthSplitLayout
      label="Admin access"
      headline="Manage the YieldMatrix network."
      body="Sign in to oversee farmers, buyers and drivers in one place."
      note="Admin access is provisioned internally."
    >
      <ContentCard title="Admin Login" subtitle="Sign in with your email and password">
        <form className="ym02-form" onSubmit={handleSubmit} noValidate>
          {formError && <Alert type="error">{formError}</Alert>}
          <div className="ym02-field-box">
            <InputField
              id="admin-email"
              label="Email address"
              type="email"
              placeholder="Enter your email address"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
            />
          </div>
          <div className="ym02-field-box">
            <InputField
              id="admin-password"
              label="Password"
              type="password"
              placeholder="Enter your password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
            />
          </div>
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? 'Logging in…' : 'Log in'}
          </Button>
          <Link className="ym02-link ym02-link--center" to="/account/forgot-password">Forgot password?</Link>
        </form>
      </ContentCard>
    </AuthSplitLayout>
  );
}