import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth, type Role } from '../../context/AuthContext';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { ContentCard } from '../../components/ContentCard';
import yieldMatrixLogo from '../../assets/yieldmatrix-logo.webp';
const accounts: { role: Role; label: string; name: string }[] = [
  { role: 'farmer', label: 'Farmer', name: 'Demo Farmer' },
  { role: 'buyer', label: 'Buyer / Shop', name: 'Demo Buyer' },
  { role: 'driver', label: 'Driver', name: 'Demo Driver' },
  { role: 'admin', label: 'Admin', name: 'Demo Admin' },
];
export default function LoginPage() {
  const { user, loading, demoLogin } = useAuth();
  const navigate = useNavigate();
  const [pending, setPending] = useState<Role | null>(null);
  const [error, setError] = useState('');
  if (loading) return <p className="loading-state" role="status">Checking your session…</p>;
  if (user) return <Navigate to={`/${user.role}/overview`} replace />;
  async function login(role: Role) {
    setPending(role); setError('');
    try { await demoLogin(role); navigate(`/${role}/overview`, { replace: true }); }
    catch { setError('Unable to sign in. Check that the backend is running, then try again.'); }
    finally { setPending(null); }
  }
  return <main className="login-page"><div className="login-panel">
    <div className="login-brand"><img className="brand-mark" src={yieldMatrixLogo} alt="" width={48} height={48} /><span>Yield<span className="brand-accent">Matrix</span></span></div>
    <ContentCard title="One network. Four workspaces." subtitle="Intelligent Agricultural Supply Chain and Bulk Fulfilment Network">
      <Alert type="info">Development sample login. Wallet funds and payments are simulated.</Alert>
      <div className="login-actions">{accounts.map(({ role, label, name }) => <Button key={role} variant={role === 'buyer' ? 'secondary' : 'primary'} disabled={pending !== null} onClick={() => void login(role)}>{pending === role ? 'Signing in…' : `Login as ${label} - ${name}`}</Button>)}</div>
      {error && <Alert type="error">{error}</Alert>}
    </ContentCard><p className="login-note">Grow. Connect. Thrive.</p>
  </div></main>;
}
