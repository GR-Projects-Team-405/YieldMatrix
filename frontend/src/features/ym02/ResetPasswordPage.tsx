import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AuthSplitLayout from './AuthSplitLayout';
import { ContentCard } from '../../components/ContentCard';
import { InputField } from '../../components/InputField';
import { Button } from '../../components/Button';

const MIN_LENGTH = 15;
const MAX_LENGTH = 128;

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [done, setDone] = useState(false);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const next: { password?: string; confirm?: string } = {};
    if (password.length < MIN_LENGTH) next.password = `Use at least ${MIN_LENGTH} characters.`;
    else if (password.length > MAX_LENGTH) next.password = `Use no more than ${MAX_LENGTH} characters.`;
    if (confirm !== password) next.confirm = 'Passwords do not match.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    // TODO: send { token, password } to the YM02 reset-password API.
    // On an invalid or expired token show the "link is not valid" view below.
    setDone(true);
  }

  return (
    <AuthSplitLayout
      label="New password"
      headline="Choose a strong new password."
      body="Use 15 to 128 characters. Spaces are allowed."
    >
      {!token ? (
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
            <Button type="submit" variant="primary">Save new password</Button>
            <Link className="ym02-link ym02-link--center" to="/account/login">Back to login</Link>
          </form>
        </ContentCard>
      )}
    </AuthSplitLayout>
  );
}