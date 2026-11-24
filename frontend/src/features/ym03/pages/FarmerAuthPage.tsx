
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import {
  ArrowRight,
  Eye,
  EyeOff,
  Mail,
  UserRound,
  ShieldCheck,
  TrendingUp,
  Truck,
} from 'lucide-react';
import {
  registerFarmer,
  getRegistrationError,
} from '../services/registrationApi';
import {
  loginWithYm03,
  getLoginError,
} from '../services/loginApi';

type AuthMode = 'signup' | 'login';

const districts = [
  'Nuwara Eliya',
  'Badulla',
  'Kandy',
  'Matale',
  'Anuradhapura',
  'Polonnaruwa',
  'Kurunegala',
  'Gampaha',
  'Hambantota',
];

const dashboardImage =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAJZW_r5rbH6tsVvBtJavFxFOjt6gsAlJFFQW6j5JuZ1Rtb4bi3JFoCAI7FLMlB5hkyEi4Qe5r9x9grAwOu1dpo6n0ZBoLieQwyF-oQnl0eSOvrA5tm6Vws_OyOwD1E-SKkZ9Y3OWhNuXmyN6dIATDRvuYKsPBXngTckwpXt4GRXL_rJLnBreswbu0LqVtjWt_sAj9n35JGegfdFzh3GMg5-8SsAt9dALJMWCDXGOvdP-HOY_9QaAnNeA';

function PasswordInput({
  id,
  value,
  onChange,
  placeholder = '••••••••',
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="ym03-farmer-password">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required
        autoComplete={
          id === 'farmer-login-password'
            ? 'current-password'
            : 'new-password'
        }
      />
      <button
        type="button"
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        onClick={() => setVisible(!visible)}
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}

export default function FarmerAuthPage() {
  const navigate = useNavigate();
  const { completePasswordLogin } = useAuth();

  const [mode, setMode] = useState<AuthMode>('signup');
  const [message, setMessage] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [farmName, setFarmName] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [district, setDistrict] = useState('Nuwara Eliya');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const passwordValid =
    password.length >= 15 && password.length <= 128;

  const passwordsMatch =
    confirmPassword.length > 0 &&
    password === confirmPassword;

  function switchMode(next: AuthMode) {
    setMode(next);
    setMessage('');
  }

  async function handleSignup(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    if (isSubmitting) return;

    setMessage('');

    if (!passwordValid) {
      setMessage('Password must contain 15–128 characters.');
      return;
    }

    if (!passwordsMatch) {
      setMessage('Passwords do not match.');
      return;
    }

    if (!acceptTerms) {
      setMessage('Please accept the Terms of Service.');
      return;
    }

    if (!pickupAddress.trim()) {
      setMessage('Farm pickup address is required.');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await registerFarmer({
        role: 'farmer',
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        district,
        password,
        farmName: farmName.trim(),
        pickupAddress: pickupAddress.trim(),
      });

      // This branch will only run when the backend
      // implements real registration successfully.
      if (
        result.registrationId &&
        result.approvalStatus === 'pending'
      ) {
        setMessage(
          'Registration submitted successfully. ' +
          'Your account is pending approval.'
        );
        setPassword('');
        setConfirmPassword('');
      } else {
        setMessage(
          'The server returned an unexpected registration response.'
        );
      }
    } catch (error) {
      const registrationError = getRegistrationError(error);

      const fieldMessages = registrationError.fields
        ? Object.values(registrationError.fields).join(' ')
        : '';

      setMessage(
        fieldMessages
          ? `${registrationError.message} ${fieldMessages}`
          : registrationError.message
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isLoggingIn) return;

    setMessage('');

    const normalizedEmail = loginIdentifier.trim().toLowerCase();

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) ||
      normalizedEmail.length > 254
    ) {
      setMessage('Enter a valid email address.');
      return;
    }

    if (!loginPassword || loginPassword.length > 128) {
      setMessage('Enter your password.');
      return;
    }

    setIsLoggingIn(true);

    try {
      const result = await loginWithYm03(
        {
          email: normalizedEmail,
          password: loginPassword,
        },
        'farmer'
      );

      // Store a session only after successful authentication
      // and role verification.
      completePasswordLogin(
        result.token,
        result.user,
        'farmer'
      );

      setLoginPassword('');

      navigate('/farmer/overview', { replace: true });
    } catch (error) {
      const loginError = getLoginError(error);

      setMessage(loginError.message);
    } finally {
      setIsLoggingIn(false);
    }
  }

  return (
    <div className="ym03-farmer-page">
      <div className="ym03-farmer-shell">

        <aside className="ym03-farmer-hero">
          <div>
            <span className="ym03-farmer-badge">
              <span>♧</span> FARMER ECOSYSTEM
            </span>

            <h1>Grow more with YieldMatrix.</h1>

            <p>
              Manage harvests, reach buyers, and build a
              stronger farming business with transparent
              market demand and guaranteed logistics.
            </p>
          </div>

          <div className="ym03-farmer-showcase">
            <img
              src={dashboardImage}
              alt="YieldMatrix agricultural dashboard"
            />
            <div className="ym03-farmer-image-caption">
              <span>◈ Connected Telemetry</span>
              <span>LIVE SYNC</span>
            </div>
          </div>

          <div className="ym03-farmer-hero-bottom">
            <div className="ym03-farmer-volume">
              <div className="ym03-farmer-truck">
                <Truck size={19} />
              </div>
              <div>
                <small>PRODUCE VOLUME TRADED</small>
                <strong>3,670 kg active this week</strong>
              </div>
              <span className="ym03-farmer-growth">
                <TrendingUp size={14} /> +18.6%
              </span>
            </div>

            <p>
              <ShieldCheck size={16} />
              Direct payments cleared into rural bank
              networks within 24 hours.
            </p>
          </div>
        </aside>

        <section className="ym03-farmer-auth">
          <div className="ym03-farmer-form-container">

            <div className="ym03-farmer-tabs">
              <button
                type="button"
                className={mode === 'signup' ? 'active' : ''}
                onClick={() => switchMode('signup')}
                aria-pressed={mode === 'signup'}
              >
                Create Account
              </button>
              <button
                type="button"
                className={mode === 'login' ? 'active' : ''}
                onClick={() => switchMode('login')}
                aria-pressed={mode === 'login'}
              >
                Log In
              </button>
            </div>

            {mode === 'signup' ? (
              <div>
                <h2>Create your Farmer account</h2>
                <p className="ym03-farmer-subtitle">
                  Join YieldMatrix and bring your harvest
                  to more buyers.
                </p>

                <form
                  className="ym03-farmer-form"
                  onSubmit={handleSignup}
                >
                  <label htmlFor="farmer-name">Full Name</label>
                  <div className="ym03-farmer-input-icon">
                    <UserRound size={18} />
                    <input
                      id="farmer-name"
                      placeholder="e.g. Nimal Perera"
                      autoComplete="name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      minLength={2}
                    />
                  </div>

                  <label htmlFor="farmer-email">
                    Email Address
                  </label>
                  <div className="ym03-farmer-input-icon">
                    <Mail size={18} />
                    <input
                      id="farmer-email"
                      type="email"
                      placeholder="nimal.perera@agrifarm.lk"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>

                  <label htmlFor="farmer-phone">
                    Mobile Number
                  </label>
                  <div className="ym03-farmer-phone">
                    <span>+94</span>
                    <input
                      id="farmer-phone"
                      type="tel"
                      placeholder="77 123 4567"
                      autoComplete="tel-national"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      pattern="0?7[0-9 ]{8,11}"
                      title="Enter a Sri Lankan mobile number"
                      required
                    />
                  </div>

                  <div className="ym03-farmer-two-cols">
                    <div>
                      <label htmlFor="farmer-farm">
                        Farm Name
                      </label>
                      <input
                        id="farmer-farm"
                        placeholder="Green Valley Farm"
                        value={farmName}
                        onChange={(e) => setFarmName(e.target.value)}
                        required
                      />
                    </div>

                    <div>
                      <label htmlFor="farmer-district">
                        District
                      </label>
                      <select
                        id="farmer-district"
                        value={district}
                        onChange={(e) => setDistrict(e.target.value)}
                        required
                      >
                        {districts.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <label htmlFor="farmer-pickup-address">
                    Farm Pickup Address
                  </label>
                  <input
                    id="farmer-pickup-address"
                    type="text"
                    placeholder="Enter the address for produce pickup"
                    value={pickupAddress}
                    onChange={(e) => setPickupAddress(e.target.value)}
                    autoComplete="street-address"
                    maxLength={500}
                    required
                  />

                  <div className="ym03-farmer-label-row">
                    <label htmlFor="farmer-password">
                      Password
                    </label>
                    <small>15–128 characters</small>
                  </div>
                  <PasswordInput
                    id="farmer-password"
                    value={password}
                    onChange={setPassword}
                  />

                  {password && (
                    <small
                      className={
                        passwordValid
                          ? 'ym03-farmer-valid'
                          : 'ym03-farmer-invalid'
                      }
                    >
                      {passwordValid
                        ? 'Password length accepted'
                        : 'Use 15–128 characters'}
                    </small>
                  )}

                  <label htmlFor="farmer-confirm-password">
                    Confirm Password
                  </label>
                  <PasswordInput
                    id="farmer-confirm-password"
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                  />

                  {confirmPassword && (
                    <small
                      className={
                        passwordsMatch
                          ? 'ym03-farmer-valid'
                          : 'ym03-farmer-invalid'
                      }
                    >
                      {passwordsMatch
                        ? 'Passwords match'
                        : 'Passwords do not match'}
                    </small>
                  )}

                  <label className="ym03-farmer-check-row">
                    <input
                      type="checkbox"
                      checked={acceptTerms}
                      onChange={(e) =>
                        setAcceptTerms(e.target.checked)
                      }
                      required
                    />
                    <span>
                      I accept the Terms of Service and
                      Privacy Policy
                    </span>
                  </label>

                  <button
                    type="submit"
                    className="ym03-farmer-submit"
                    disabled={isSubmitting}
                  >
                    {isSubmitting
                      ? 'Submitting Registration...'
                      : 'Create Farmer Account'}

                    {!isSubmitting && <ArrowRight size={18} />}
                  </button>

                  <p className="ym03-farmer-switch">
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => switchMode('login')}
                    >
                      Log in
                    </button>
                  </p>

                  <div className="ym03-farmer-note">
                    Submitted farmer registrations undergo
                    verification by district agricultural officers.
                  </div>
                </form>
              </div>
            ) : (
              <div>
                <h2>Welcome back, Farmer!</h2>
                <p className="ym03-farmer-subtitle">
                  Sign in to manage your farms and harvests.
                </p>

                <form
                  className="ym03-farmer-form"
                  onSubmit={handleLogin}
                >
                  <label htmlFor="farmer-login-identifier">
                    Email Address
                  </label>
                  <div className="ym03-farmer-input-icon">
                    <UserRound size={18} />
                    <input
                      id="farmer-login-identifier"
                      type="email"
                      placeholder="Enter your email address"
                      autoComplete="username"
                      value={loginIdentifier}
                      onChange={(e) =>
                        setLoginIdentifier(e.target.value)
                      }
                      required
                    />
                  </div>

                  <div className="ym03-farmer-label-row">
                    <label htmlFor="farmer-login-password">
                      Password
                    </label>
                    <Link to="/account/forgot-password">
                      Forgot Password?
                    </Link>
                  </div>

                  <PasswordInput
                    id="farmer-login-password"
                    value={loginPassword}
                    onChange={setLoginPassword}
                  />

                  <button
                    type="submit"
                    className="ym03-farmer-submit"
                    disabled={isLoggingIn}
                  >
                    {isLoggingIn
                      ? 'Signing In...'
                      : 'Log In to Farm Dashboard'}

                    {!isLoggingIn && <ArrowRight size={18} />}
                  </button>

                  <p className="ym03-farmer-switch">
                    Don't have an account yet?{' '}
                    <button
                      type="button"
                      onClick={() => switchMode('signup')}
                    >
                      Register your farm
                    </button>
                  </p>
                </form>
              </div>
            )}

            {message && (
              <div
                className="ym03-farmer-message"
                role="status"
              >
                {message}
              </div>
            )}

          </div>
        </section>
      </div>
    </div>
  );
}
