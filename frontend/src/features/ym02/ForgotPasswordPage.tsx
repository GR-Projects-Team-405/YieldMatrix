import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import AuthSplitLayout from './AuthSplitLayout';
import { ContentCard } from '../../components/ContentCard';
import { InputField } from '../../components/InputField';
import { Button } from '../../components/Button';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const value = email.trim();
    if (!value) return setError('Enter your email address.');
    if (!/^\S+@\S+\.\S+$/.test(value)) return setError('Enter a valid email address.');
    setError('');

    // TODO: call the YM02 forgot-password API here.
    // Always show the same message, whether or not the email has an account.
    setSubmitted(true);
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
            <Button type="submit" variant="primary">Send reset link</Button>
            <Link className="ym02-link ym02-link--center" to="/account/login">Back to login</Link>
          </form>
        </ContentCard>
      )}
    </AuthSplitLayout>
  );
}