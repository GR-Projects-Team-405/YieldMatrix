import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { isAxiosError } from 'axios';
import api from '../../services/api';
import AuthSplitLayout from './AuthSplitLayout';
import { ContentCard } from '../../components/ContentCard';
import { InputField } from '../../components/InputField';
import { Button } from '../../components/Button';
import { Alert } from '../../components/Alert';

function messageFor(error: unknown): string {
  if (isAxiosError(error) && error.response) {
    if (error.response.status === 422) return 'Enter a valid email address.';
    if (error.response.status === 429) return 'Too many attempts. Try again later.';
  }
  return 'Something went wrong. Please try again.';
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    const value = email.trim();
    setFormError('');
    if (!value) return setError('Enter your email address.');
    if (!/^\S+@\S+\.\S+$/.test(value)) return setError('Enter a valid email address.');
    setError('');

    setSubmitting(true);
    try {
      // The API gives the same answer whether or not the email has an account.
      await api.post('/ym02/forgot-password', { email: value });
      setSubmitted(true);
    } catch (err) {
      setFormError(messageFor(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthSplitLayout
      label="Account help"
      headline="Locked out? Let's get you back in."
      body="Enter your email and we'll send you a reset link."
    >
      {submitted ? (
        <ContentCard title="Check your email" subtitle="Reset instructions have been requested.">
          <div className="ym02-form" role="status">
            <p className="module-note">
              If an account exists for <strong>{email.trim()}</strong>, a password reset link has been sent.
              The link expires soon, so use it as soon as you can.
            </p>
            <Link className="ym02-link ym02-link--center" to="/account/login">Back to login</Link>
          </div>
        </ContentCard>
      ) : (
        <ContentCard title="Forgot Password" subtitle="Enter your email and we'll send you a reset link">
          <form className="ym02-form" onSubmit={handleSubmit} noValidate>
            {formError && <Alert type="error">{formError}</Alert>}
            <div className="ym02-field-box">
              <InputField
                id="forgot-email"
                label="Email address"
                type="email"
                autoComplete="email"
                placeholder="Enter your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={error}
              />
            </div>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? 'Sending…' : 'Send reset link'}
            </Button>
            <Link className="ym02-link ym02-link--center" to="/account/login">Back to login</Link>
          </form>
        </ContentCard>
      )}
    </AuthSplitLayout>
  );
}