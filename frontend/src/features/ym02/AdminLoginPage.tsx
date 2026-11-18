import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import AuthSplitLayout from './AuthSplitLayout';
import { ContentCard } from '../../components/ContentCard';
import { InputField } from '../../components/InputField';
import { Button } from '../../components/Button';
import { Alert } from '../../components/Alert';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState('');

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const next: { email?: string; password?: string } = {};
    if (!email.trim()) next.email = 'Enter your email address.';
    else if (!/^\S+@\S+\.\S+$/.test(email.trim())) next.email = 'Enter a valid email address.';
    if (!password) next.password = 'Enter your password.';
    setErrors(next);
    setFormError('');
    if (Object.keys(next).length > 0) return;

    // TODO (Mon 23 Nov): call the YM02 login API here.
    // On failure show the generic message: "Email or password is incorrect."
  }

  return (
    <AuthSplitLayout
      label="Admin access"
      headline="Manage YieldMatrix with confidence"
      body="Sign in to review accounts, approvals and platform activity."
      chip="Authorised administrators only"
    >
      <ContentCard title="Admin Login" subtitle="Sign in with your administrator account.">
        <form className="ym02-form" onSubmit={handleSubmit} noValidate>
          {formError && <Alert type="error">{formError}</Alert>}
          <InputField
            id="admin-email"
            label="Email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
          />
          <InputField
            id="admin-password"
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
          />
          <div className="ym02-links">
            <Link className="ym02-link" to="/account/forgot-password">Forgot password?</Link>
          </div>
          <Button type="submit" variant="primary">Log in</Button>
        </form>
      </ContentCard>
    </AuthSplitLayout>
  );
}