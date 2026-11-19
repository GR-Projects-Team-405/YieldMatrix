
import { useState, type FormEvent } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  MapPin,
  Phone,
  ShoppingBasket,
  Store,
  UserRound,
} from 'lucide-react';

type AuthMode = 'signup' | 'login';
type BuyerType = 'individual' | 'commercial';

const buyerImage =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDYbcn2Pd7tUqIDE1_jW4qfX4O1yMHXDGdLLDslSeg1tdpAZu8KmsAdZrERHG9f6UEadmtKsBo8IMiRmnEKNvhAHjPY3056bm5b7fcQ0jocbM42nvUckBsrr_cKmVyLRCmwJSf8PaEujSMsPw-knEFxlwh7qsdWGsgG-1A9n4A_IXyMQLcWCeKgjgpEiP4BghPqpNDO0NRipFP37qAZocEjiYBs0mQq3O3Oy0ieW0fe';

const districts = [
  { value: 'Colombo', label: 'Colombo (Western Province)' },
  { value: 'Gampaha', label: 'Gampaha (Western Province)' },
  { value: 'Kalutara', label: 'Kalutara (Western Province)' },
  { value: 'Kandy', label: 'Kandy (Central Province)' },
  { value: 'Kurunegala', label: 'Kurunegala (North Western Province)' },
  { value: 'Galle', label: 'Galle (Southern Province)' },
];

function PasswordField({
  id,
  value,
  onChange,
  login = false,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  login?: boolean;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="ym03-buyer-field">
      <LockKeyhole size={19} aria-hidden="true" />

      <input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="••••••••"
        autoComplete={login ? 'current-password' : 'new-password'}
        required
      />

      <button
        type="button"
        className="ym03-buyer-eye"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}

export default function BuyerAuthPage() {
  const [mode, setMode] = useState<AuthMode>('signup');
  const [buyerType, setBuyerType] = useState<BuyerType>('commercial');

  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [district, setDistrict] = useState('Colombo');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  const [feedback, setFeedback] = useState('');

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setFeedback('');
  }

  function handleSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback('');

    if (buyerType === 'commercial' && !businessName.trim()) {
      setFeedback('Business / Shop Name is required.');
      return;
    }

    if (password.length < 15 || password.length > 128) {
      setFeedback('Password must contain 15–128 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setFeedback('Password and Confirm Password do not match.');
      return;
    }

    const normalizedMobile = mobile.replace(/[\s()-]/g, '');

    if (!/^(?:\+94|0)?7\d{8}$/.test(normalizedMobile)) {
      setFeedback('Enter a valid Sri Lankan mobile number.');
      return;
    }

    if (!termsAccepted) {
      setFeedback('Please accept the Terms of Service.');
      return;
    }

    setFeedback(
      'Form validation passed. Buyer registration API integration is pending.'
    );
  }

  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!loginIdentifier.trim() || !loginPassword) {
      setFeedback('Please enter your email/mobile and password.');
      return;
    }

    setFeedback(
      'Login form validation passed. Authentication API integration is pending.'
    );
  }

  return (
    <div className="ym03-buyer-page">
      <div className="ym03-buyer-shell">

        <aside className="ym03-buyer-hero">
          <div className="ym03-buyer-hero-top">
            <span className="ym03-buyer-badge">
              <Store size={14} />
              COMMERCIAL BUYERS & SHOPS
            </span>

            <h1>
              Fresh produce.
              <span>Better connections.</span>
            </h1>

            <p>
              Connect with trusted growers and simplify the way
              you source agricultural products directly from the
              field with guaranteed freshness and cold-chain
              compliance.
            </p>
          </div>

          <div className="ym03-buyer-showcase">
            <img
              src={buyerImage}
              alt="Fresh produce distribution facility"
            />

            <div className="ym03-buyer-image-caption">
              <CheckCircle2 size={16} />
              <span>
                Direct Field Procurement • Cold-Chain Logged
              </span>
            </div>
          </div>

          <div className="ym03-buyer-hero-bottom">
            <div className="ym03-buyer-volume">
              <span className="ym03-buyer-volume-icon">
                <ShoppingBasket size={19} />
              </span>
              <div>
                <small>LIVE TRADE VOLUME</small>
                <strong>
                  LKR 1.84M accepted • 100% verified origins
                </strong>
              </div>
            </div>

            <div className="ym03-buyer-reassurance">
              <span>
                <CheckCircle2 size={15} />
                Zero Wholesale Middlemen
              </span>
              <span>
                <CheckCircle2 size={15} />
                Same-Day Dispatch
              </span>
            </div>
          </div>
        </aside>

        <section className="ym03-buyer-auth">
          <div className="ym03-buyer-form-container">
            <div className="ym03-buyer-tabs">
              <button
                type="button"
                className={mode === 'signup' ? 'active' : ''}
                onClick={() => changeMode('signup')}
                aria-pressed={mode === 'signup'}
              >
                Create Account
              </button>

              <button
                type="button"
                className={mode === 'login' ? 'active' : ''}
                onClick={() => changeMode('login')}
                aria-pressed={mode === 'login'}
              >
                Log In
              </button>
            </div>

            {mode === 'signup' ? (
              <div>
                <h2>Create your Buyer / Shop Account</h2>
                <p className="ym03-buyer-subtitle">
                  Start sourcing quality produce directly
                  through YieldMatrix
                </p>

                <form
                  className="ym03-buyer-form"
                  onSubmit={handleSignup}
                >
                  <div className="ym03-buyer-classification">
                    <label>ACCOUNT CLASSIFICATION</label>

                    <div className="ym03-buyer-type-tabs">
                      <button
                        type="button"
                        className={
                          buyerType === 'individual' ? 'active' : ''
                        }
                        onClick={() => {
                          setBuyerType('individual');
                          setFeedback('');
                        }}
                        aria-pressed={buyerType === 'individual'}
                      >
                        Individual Buyer
                      </button>

                      <button
                        type="button"
                        className={
                          buyerType === 'commercial' ? 'active' : ''
                        }
                        onClick={() => {
                          setBuyerType('commercial');
                          setFeedback('');
                        }}
                        aria-pressed={buyerType === 'commercial'}
                      >
                        Shop / Commercial
                      </button>
                    </div>
                  </div>

                  <label htmlFor="buyer-fullname">Full Name</label>
                  <div className="ym03-buyer-field">
                    <UserRound size={19} />
                    <input
                      id="buyer-fullname"
                      placeholder="e.g. Dilani Jayawardena"
                      autoComplete="name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      minLength={2}
                    />
                  </div>

                  <label htmlFor="buyer-business">
                    Business / Shop Name
                    {buyerType === 'commercial' && (
                      <span className="ym03-buyer-required">
                        Required
                      </span>
                    )}
                  </label>

                  <div
                    className={`ym03-buyer-field ${
                      buyerType === 'individual'
                        ? 'ym03-buyer-disabled'
                        : ''
                    }`}
                  >
                    <Store size={19} />
                    <input
                      id="buyer-business"
                      placeholder="FreshMart Organics Colombo"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      disabled={buyerType === 'individual'}
                      required={buyerType === 'commercial'}
                    />
                  </div>

                  <div className="ym03-buyer-two-cols">
                    <div>
                      <label htmlFor="buyer-email">
                        Email Address
                      </label>
                      <div className="ym03-buyer-field">
                        <Mail size={19} />
                        <input
                          id="buyer-email"
                          type="email"
                          placeholder="dilani@freshmart.lk"
                          autoComplete="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="buyer-mobile">
                        Mobile Number
                      </label>
                      <div className="ym03-buyer-field">
                        <Phone size={19} />
                        <input
                          id="buyer-mobile"
                          type="tel"
                          placeholder="+94 71 123 4567"
                          autoComplete="tel"
                          value={mobile}
                          onChange={(e) => setMobile(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <label htmlFor="buyer-district">
                    District / Delivery Location
                  </label>
                  <div className="ym03-buyer-field">
                    <MapPin size={19} />
                    <select
                      id="buyer-district"
                      value={district}
                      onChange={(e) => setDistrict(e.target.value)}
                    >
                      {districts.map((item) => (
                        <option
                          key={item.value}
                          value={item.value}
                        >
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="ym03-buyer-two-cols">
                    <div>
                      <label htmlFor="buyer-password">
                        Password
                      </label>
                      <PasswordField
                        id="buyer-password"
                        value={password}
                        onChange={setPassword}
                      />
                    </div>

                    <div>
                      <label htmlFor="buyer-confirm">
                        Confirm Password
                      </label>
                      <PasswordField
                        id="buyer-confirm"
                        value={confirmPassword}
                        onChange={setConfirmPassword}
                      />
                    </div>
                  </div>

                  {confirmPassword &&
                    password !== confirmPassword && (
                      <small className="ym03-buyer-error">
                        Passwords do not match.
                      </small>
                    )}

                  <small className="ym03-buyer-password-hint">
                    Password must contain 15–128 characters.
                  </small>

                  <label className="ym03-buyer-checkbox">
                    <input
                      type="checkbox"
                      checked={termsAccepted}
                      onChange={(e) =>
                        setTermsAccepted(e.target.checked)
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
                    className="ym03-buyer-submit"
                  >
                    Create Buyer Account
                    <ArrowRight size={18} />
                  </button>

                  <p className="ym03-buyer-switch">
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => changeMode('login')}
                    >
                      Log in
                    </button>
                  </p>
                </form>
              </div>
            ) : (
              <div>
                <h2>Welcome back, Buyer!</h2>

                <p className="ym03-buyer-subtitle">
                  Sign into manage your produce purchases
                  and dispatch orders.
                </p>

                <form
                  className="ym03-buyer-form"
                  onSubmit={handleLogin}
                >
                  <label htmlFor="buyer-login-identifier">
                    Email Address or Mobile Number
                  </label>

                  <div className="ym03-buyer-field">
                    <UserRound size={19} />
                    <input
                      id="buyer-login-identifier"
                      placeholder="Email or mobile number"
                      autoComplete="username"
                      value={loginIdentifier}
                      onChange={(e) =>
                        setLoginIdentifier(e.target.value)
                      }
                      required
                    />
                  </div>

                  <label htmlFor="buyer-login-password">
                    Password
                  </label>

                  <PasswordField
                    id="buyer-login-password"
                    value={loginPassword}
                    onChange={setLoginPassword}
                    login
                  />

                  <label className="ym03-buyer-checkbox">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) =>
                        setRememberMe(e.target.checked)
                      }
                    />
                    <span>Stay signed in on this device</span>
                  </label>

                  <button
                    type="submit"
                    className="ym03-buyer-submit"
                  >
                    Log In to Shop Dashboard
                    <ArrowRight size={18} />
                  </button>

                  <p className="ym03-buyer-switch">
                    Don't have an account yet?{' '}
                    <button
                      type="button"
                      onClick={() => changeMode('signup')}
                    >
                      Register your shop
                    </button>
                  </p>
                </form>
              </div>
            )}

            {feedback && (
              <div className="ym03-buyer-feedback" role="status">
                {feedback}
              </div>
            )}
          </div>
        </section>

      </div>
    </div>
  );
}
