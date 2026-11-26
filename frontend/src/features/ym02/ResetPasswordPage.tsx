import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { isAxiosError } from 'axios';
import api from '../../services/api';
import AuthSplitLayout from './AuthSplitLayout';
import { ContentCard } from '../../components/ContentCard';
import { InputField } from '../../components/InputField';
import { Button } from '../../components/Button';
import { Alert } from '../../components/Alert';

const MIN_LENGTH = 15;
const MAX_LENGTH = 128;

function messageFor(error: unknown): string {
  if (isAxiosError(error) && error.response) {
    if (error.response.status === 422) return 'Check your new password and try again.';
    if (error.response.status === 429) return 'Too many attempts. Try again later.';
  }
  return 'Something went wrong. Please try again.';
}

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [invalidLink, setInvalidLink] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setFormError('');
    const next: { password?: string; confirm?: string } = {};
    const length = Array.from(password).length;
    if (length < MIN_LENGTH) next.password = `Use at least ${MIN_LENGTH} characters.`;
    else if (length > MAX_LENGTH) next.password = `Use no more than ${MAX_LENGTH} characters.`;
    if (confirm !== password) next.confirm = 'Passwords do not match.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    try {
      await api.post('/ym02/reset-password', { token, password });
      setDone(true);
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 400) setInvalidLink(true);
      else setFormError(messageFor(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthSplitLayout
      label="New password"
      headline="Choose a strong new password."
      body="Use 15 to 128 characters. Spaces are allowed."
    >
      {!token || invalidLink ? (
        <ContentCard title="Reset link not valid" subtitle="This link is missing or has expired.">
          <div className="ym02-form">
            <p className="module-note">Request a new reset link to continue.</p>
            <Link className="ym02-link ym02-link--center" to="/account/forgot-password">Request a new link</Link>
          </div>
        </ContentCard>
      ) : done ? (
        <ContentCard title="Password updated" subtitle="You can now log in with your new password.">
          <div className="ym02-form" role="status">
            <Link className="ym02-link ym02-link--center" to="/account/login">Go to login</Link>
          </div>
        </ContentCard>
      ) : (
        <ContentCard title="Reset password" subtitle="Choose a new password for your account">
          <form className="ym02-form" onSubmit={handleSubmit} noValidate>
            {formError && <Alert type="error">{formError}</Alert>}
            <div className="ym02-field-box">
              <InputField
                id="reset-password"
                label="New password"
                type="password"
                autoComplete="new-password"
                placeholder="Enter new password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={errors.password}
              />
            </div>
            <p className="ym02-hint">Use 15 to 128 characters. Spaces are allowed</p>
            <div className="ym02-field-box">
              <InputField
                id="reset-confirm"
                label="Confirm new password"
                type="password"
                autoComplete="new-password"
                placeholder="Re-enter new password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                error={errors.confirm}
              />
            </div>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save new password'}
            </Button>
            <Link className="ym02-link ym02-link--center" to="/account/login">Back to login</Link>
          </form>
        </ContentCard>
      )}
    </AuthSplitLayout>
  );
}