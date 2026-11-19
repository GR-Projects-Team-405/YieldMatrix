
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  MapPin,
  Phone,
  Route,
  ShieldCheck,
  Truck,
  UserRound,
  Weight,
} from 'lucide-react';

type AuthMode = 'register' | 'login';
type RegistrationStep = 1 | 2;

const operatingAreas = [
  'Kandy & Central Province',
  'Matale & Dambulla Agricultural Belt',
  'Nuwara Eliya Cold Region',
  'Kurunegala & North Western',
  'Western Metro & Colombo Port Hubs',
];

const vehicleTypes = [
  {
    value: 'lgv',
    label: 'Light Goods Vehicle (Pickups / Crew Cabs)',
  },
  {
    value: 'mini_lorry',
    label: 'Mini Lorry (Up to 1.5 Tons Capacity)',
  },
  {
    value: 'refrigerated',
    label: 'Refrigerated Truck (Cold-chain Certified)',
  },
  {
    value: 'heavy_flatbed',
    label: 'Commercial Flatbed Lorry (3+ Tons)',
  },
];

const driverPortrait =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBgRA3mB5F59pk7Aufqkrpc_VKGqbmtfBXm-WUWUD00eR7HRWSspd3RojZjaQGFW2QRSNyzjx4rmo6Cz7PtK6Co2J0GMXKc5Qlu05_UgbPA69dvI-0IyOcTF7BiYrXgKLWWxxvJcXZm2mftn92Kkh85DO57bPlIeCaE40Gf8utfZEdDsxNHLJ5Z8cT5epL89G646rV-fqHErWUAwYabaynULgS6iPES8fm_9yVwHQ7p';

function DriverPasswordField({
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
    <div className="ym03-driver-password">
      <LockKeyhole size={18} aria-hidden="true" />
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        placeholder={login ? 'Enter driver password' : 'Create password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={login ? 'current-password' : 'new-password'}
        required
      />
      <button
        type="button"
        onClick={() => setVisible((previous) => !previous)}
        aria-label={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}

export default function DriverAuthPage() {
  const [mode, setMode] = useState<AuthMode>('register');
  const [step, setStep] = useState<RegistrationStep>(1);
  const [feedback, setFeedback] = useState('');

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [operatingArea, setOperatingArea] =
    useState(operatingAreas[0]);

  const [vehicleType, setVehicleType] = useState('mini_lorry');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [licenceNumber, setLicenceNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreement, setAgreement] = useState(false);

  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setFeedback('');
  }

  function handlePersonalDetails(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setFeedback('');

    const normalizedMobile = mobile.replace(/[\s()-]/g, '');

    if (!/^(?:\+94|0)?7\d{8}$/.test(normalizedMobile)) {
      setFeedback('Enter a valid Sri Lankan mobile number.');
      return;
    }

    if (!fullName.trim() || !email.trim()) {
      setFeedback('Please complete your personal details.');
      return;
    }

    setStep(2);
  }

  function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback('');

    if (!fullName.trim() || !email.trim() || !mobile.trim()) {
      setStep(1);
      setFeedback('Complete Step 1 before submitting.');
      return;
    }

    if (!registrationNumber.trim() || !licenceNumber.trim()) {
      setFeedback('Enter vehicle and driving licence details.');
      return;
    }

    if (password.length < 15 || password.length > 128) {
      setFeedback('Password must contain 15–128 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setFeedback('Passwords do not match.');
      return;
    }

    if (!agreement) {
      setFeedback('You must agree to the Driver Code of Conduct.');
      return;
    }

    setFeedback(
      'Driver form validation passed. Registration API integration is pending.'
    );
  }

  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!loginIdentifier.trim() || !loginPassword) {
      setFeedback('Enter your email/mobile and password.');
      return;
    }

    setFeedback(
      'Login form validation passed. Authentication API integration is pending.'
    );
  }

  return (
    <div className="ym03-driver-page">
      <div className="ym03-driver-shell">
        <aside className="ym03-driver-hero">
          <div className="ym03-driver-hero-top">
            <span className="ym03-driver-badge">
              <Truck size={16} />
              AGRI-LOGISTICS NETWORK
            </span>

            <h1>
              Move harvests.
              <span>Connect communities.</span>
            </h1>

            <p>
              Manage pickups, coordinate deliveries, and
              stay connected with the agricultural supply
              network across all provincial hubs.
            </p>
          </div>

          <div className="ym03-driver-route-panel">
            <div className="ym03-driver-route-heading">
              <strong>
                <span className="ym03-driver-live-dot" />
                ACTIVE ROUTE DISPATCH #LK-882
              </strong>
              <span>Cold Chain 4.2°C</span>
            </div>

            <div className="ym03-driver-route-map">
              <svg
                viewBox="0 0 400 100"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path
                  d="M 40 50 Q 150 15 260 65 T 360 45"
                  fill="none"
                  stroke="#feb37e"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <circle cx="40" cy="50" r="6" fill="#feb37e" />
                <circle cx="180" cy="38" r="5" fill="#a4d1b2" />
                <circle cx="360" cy="45" r="7" fill="#feb37e" />
              </svg>

              <div className="ym03-driver-route-stop">
                <span><Truck size={17} /></span>
                <small>Dambulla Hub</small>
              </div>

              <div className="ym03-driver-route-speed">
                <Route size={14} />
                62 km/h
              </div>

              <div className="ym03-driver-route-stop">
                <span><MapPin size={17} /></span>
                <small>Colombo Metro</small>
              </div>
            </div>

            <div className="ym03-driver-route-stats">
              <span>
                <BadgeCheck size={17} />
                18 completed trips this month
              </span>
              <span>
                <Weight size={17} />
                1,500 kg max capacity
              </span>
            </div>
          </div>

          <div className="ym03-driver-testimonial">
            <img
              src={driverPortrait}
              alt="Illustrative agricultural fleet partner"
            />
            <div>
              <strong>Sanjeewa Bandara</strong>
              <p>
                Fleet Partner • Central Province Route Specialist
              </p>
            </div>
          </div>
        </aside>

        <section className="ym03-driver-auth">
          <div className="ym03-driver-form-container">
            <div className="ym03-driver-tabs">
              <button
                type="button"
                className={mode === 'register' ? 'active' : ''}
                onClick={() => switchMode('register')}
                aria-pressed={mode === 'register'}
              >
                Driver Registration
              </button>

              <button
                type="button"
                className={mode === 'login' ? 'active' : ''}
                onClick={() => switchMode('login')}
                aria-pressed={mode === 'login'}
              >
                Driver Login
              </button>
            </div>

            {mode === 'register' ? (
              <>
                <div className="ym03-driver-progress">
                  <div className="ym03-driver-step-labels">
                    <button
                      type="button"
                      onClick={() => {
                        setStep(1);
                        setFeedback('');
                      }}
                      className={step === 1 ? 'active' : ''}
                    >
                      {step === 2 ? '✓' : '1'} PERSONAL
                    </button>
                    <span>›</span>
                    <span className={step === 2 ? 'active' : ''}>
                      2 VEHICLE & LICENCE
                    </span>
                  </div>
                  <div className="ym03-driver-progress-track">
                    <div
                      style={{ width: step === 1 ? '50%' : '100%' }}
                    />
                  </div>
                </div>

                <h2>Create your Driver account</h2>
                <p className="ym03-driver-subtitle">
                  Join YieldMatrix and manage your delivery operations.
                </p>

                {step === 1 ? (
                  <form
                    className="ym03-driver-form"
                    onSubmit={handlePersonalDetails}
                  >
                    <label htmlFor="ym03-driver-name">
                      Full Name (as in NIC/Licence)
                    </label>
                    <div className="ym03-driver-field">
                      <UserRound size={18} />
                      <input
                        id="ym03-driver-name"
                        placeholder="e.g. Kasun Nuwan Ranasinghe"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        autoComplete="name"
                        minLength={2}
                        required
                      />
                    </div>

                    <label htmlFor="ym03-driver-email">
                      Email Address
                    </label>
                    <div className="ym03-driver-field">
                      <Mail size={18} />
                      <input
                        id="ym03-driver-email"
                        type="email"
                        placeholder="driver@example.lk"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="email"
                        required
                      />
                    </div>

                    <label htmlFor="ym03-driver-mobile">
                      Mobile Phone Number
                    </label>
                    <div className="ym03-driver-field">
                      <Phone size={18} />
                      <input
                        id="ym03-driver-mobile"
                        type="tel"
                        placeholder="+94 7X XXX XXXX"
                        value={mobile}
                        onChange={(e) => setMobile(e.target.value)}
                        autoComplete="tel"
                        required
                      />
                    </div>

                    <label htmlFor="ym03-driver-area">
                      Primary District / Operating Area
                    </label>
                    <div className="ym03-driver-field">
                      <MapPin size={18} />
                      <select
                        id="ym03-driver-area"
                        value={operatingArea}
                        onChange={(e) =>
                          setOperatingArea(e.target.value)
                        }
                        required
                      >
                        {operatingAreas.map((area) => (
                          <option key={area} value={area}>
                            {area}
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="submit"
                      className="ym03-driver-submit"
                    >
                      Continue to Vehicle Details
                      <ArrowRight size={18} />
                    </button>
                  </form>
                ) : (
                  <form
                    className="ym03-driver-form"
                    onSubmit={handleRegister}
                  >
                    <label htmlFor="ym03-vehicle-type">
                      Vehicle Category
                    </label>
                    <div className="ym03-driver-field">
                      <Truck size={18} />
                      <select
                        id="ym03-vehicle-type"
                        value={vehicleType}
                        onChange={(e) =>
                          setVehicleType(e.target.value)
                        }
                        required
                      >
                        {vehicleTypes.map((vehicle) => (
                          <option
                            key={vehicle.value}
                            value={vehicle.value}
                          >
                            {vehicle.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="ym03-driver-two-cols">
                      <div>
                        <label htmlFor="ym03-vehicle-registration">
                          Registration No.
                        </label>
                        <input
                          id="ym03-vehicle-registration"
                          placeholder="e.g. WP LO-4811"
                          value={registrationNumber}
                          onChange={(e) =>
                            setRegistrationNumber(e.target.value)
                          }
                          required
                        />
                      </div>
                      <div>
                        <label htmlFor="ym03-driver-licence">
                          Driving Licence No.
                        </label>
                        <input
                          id="ym03-driver-licence"
                          placeholder="e.g. B-7821940"
                          value={licenceNumber}
                          onChange={(e) =>
                            setLicenceNumber(e.target.value)
                          }
                          required
                        />
                      </div>
                    </div>

                    <div className="ym03-driver-two-cols">
                      <div>
                        <label htmlFor="ym03-driver-password">
                          Password
                        </label>
                        <DriverPasswordField
                          id="ym03-driver-password"
                          value={password}
                          onChange={setPassword}
                        />
                      </div>
                      <div>
                        <label htmlFor="ym03-driver-confirm">
                          Confirm
                        </label>
                        <DriverPasswordField
                          id="ym03-driver-confirm"
                          value={confirmPassword}
                          onChange={setConfirmPassword}
                        />
                      </div>
                    </div>

                    <small className="ym03-driver-hint">
                      Use 15–128 characters for your password.
                    </small>

                    {confirmPassword &&
                      password !== confirmPassword && (
                        <small className="ym03-driver-error">
                          Passwords do not match.
                        </small>
                      )}

                    <label className="ym03-driver-agreement">
                      <input
                        type="checkbox"
                        checked={agreement}
                        onChange={(e) =>
                          setAgreement(e.target.checked)
                        }
                        required
                      />
                      <span>
                        I agree to the Driver Code of Conduct
                        & Platform Terms for safe handling and
                        timely agricultural cold delivery.
                      </span>
                    </label>

                    <button
                      type="submit"
                      className="ym03-driver-submit"
                    >
                      Create Driver Account
                      <ShieldCheck size={18} />
                    </button>

                    <button
                      type="button"
                      className="ym03-driver-back"
                      onClick={() => {
                        setStep(1);
                        setFeedback('');
                      }}
                    >
                      <ArrowLeft size={17} />
                      Edit Personal Details (Step 1)
                    </button>
                  </form>
                )}
              </>
            ) : (
              <>
                <div className="ym03-driver-login-heading">
                  <h2>Welcome back, Driver!</h2>
                  <p className="ym03-driver-subtitle">
                    Sign in to view your scheduled trips,
                    cold store handovers, and active payouts.
                  </p>
                </div>

                <form
                  className="ym03-driver-form"
                  onSubmit={handleLogin}
                >
                  <label htmlFor="ym03-driver-login-identifier">
                    Email or Mobile Number
                  </label>
                  <div className="ym03-driver-field">
                    <UserRound size={18} />
                    <input
                      id="ym03-driver-login-identifier"
                      placeholder="Email or mobile number"
                      value={loginIdentifier}
                      onChange={(e) =>
                        setLoginIdentifier(e.target.value)
                      }
                      autoComplete="username"
                      required
                    />
                  </div>

                  <div className="ym03-driver-label-row">
                    <label htmlFor="ym03-driver-login-password">
                      Password
                    </label>
                    <Link to="/account/forgot-password">
                      Forgot Password?
                    </Link>
                  </div>

                  <DriverPasswordField
                    id="ym03-driver-login-password"
                    value={loginPassword}
                    onChange={setLoginPassword}
                    login
                  />

                  <label className="ym03-driver-agreement">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) =>
                        setRememberMe(e.target.checked)
                      }
                    />
                    <span>Remember this terminal</span>
                  </label>

                  <div className="ym03-driver-dispatch-label">
                    PROVINCIAL DISPATCH
                  </div>

                  <button
                    type="submit"
                    className="ym03-driver-submit"
                  >
                    Log In to Fleet Console
                    <ArrowRight size={18} />
                  </button>

                  <p className="ym03-driver-login-switch">
                    Don't have a verified account?{' '}
                    <button
                      type="button"
                      onClick={() => switchMode('register')}
                    >
                      Register as Driver
                    </button>
                  </p>
                </form>
              </>
            )}

            {feedback && (
              <div className="ym03-driver-feedback" role="status">
                {feedback}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
