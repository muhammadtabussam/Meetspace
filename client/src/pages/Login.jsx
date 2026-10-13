import React, { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  FiArrowRight,
  FiCheck,
  FiEye,
  FiEyeOff,
  FiLock,
  FiMail,
  FiShield,
  FiVideo,
  FiZap,
} from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isSignUp = location.pathname === '/signup';
  const { user, status, authError, signIn, signUp, refresh } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setError('');
    setPassword('');
    setConfirmPassword('');
  }, [isSignUp]);

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (isSignUp && password !== confirmPassword) {
      setError('Your passwords do not match. Please check and try again.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isSignUp) {
        await signUp(email.trim(), password);
      } else {
        await signIn(email.trim(), password);
      }
      const destination = location.state?.from?.pathname || '/';
      navigate(destination, { replace: true });
    } catch (submitError) {
      setError(submitError.message || 'Authentication failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="auth-page">
      <div className="auth-ambient auth-ambient-one" />
      <div className="auth-ambient auth-ambient-two" />

      <header className="auth-topbar">
        <Link className="auth-brand" to="/login" aria-label="MeetSpace sign in">
          <span className="auth-brand-mark"><FiVideo /></span>
          <span>Meet<span>Space</span></span>
        </Link>
        <div className="auth-topbar-note">
          <span className="auth-online-dot" />
          Secure video meetings, made simple
        </div>
      </header>

      <div className="auth-layout">
        <section className="auth-story" aria-label="MeetSpace overview">
          <div className="auth-eyebrow"><FiZap /> YOUR SPACE TO CONNECT</div>
          <h1>Good conversations<br />start <span>right here.</span></h1>
          <p className="auth-story-copy">
            A calmer place for clear conversations. Meet face to face, share ideas,
            and bring your team together from anywhere.
          </p>

          <div className="auth-preview">
            <div className="auth-preview-top">
              <div className="auth-window-dots"><i /><i /><i /></div>
              <span className="auth-preview-live"><span /> LIVE ROOM</span>
            </div>
            <div className="auth-preview-people">
              <div className="auth-person auth-person-one"><span>AM</span><small>Alex Morgan</small></div>
              <div className="auth-person auth-person-two"><span>JS</span><small>Jamie Smith</small></div>
              <div className="auth-person auth-person-three"><span>RK</span><small>Riley Kim</small></div>
            </div>
            <div className="auth-preview-footer">
              <div><FiShield /><span>Private by design</span></div>
              <span className="auth-wave"><i /><i /><i /><i /><i /><i /><i /></span>
            </div>
          </div>

          <div className="auth-benefits">
            <div><span><FiCheck /></span> One-click meetings, no complicated setup</div>
            <div><span><FiCheck /></span> Stay connected from any device</div>
            <div><span><FiCheck /></span> Your account, protected with secure sign-in</div>
          </div>
        </section>

        <section className="auth-card-wrap">
          <div className="auth-card">
            <div className="auth-card-icon"><FiLock /></div>
            <div className="auth-card-heading">
              <p className="auth-card-kicker">{isSignUp ? 'GET STARTED FOR FREE' : 'WELCOME BACK'}</p>
              <h2>{isSignUp ? 'Create your account' : 'Sign in to MeetSpace'}</h2>
              <p>{isSignUp ? 'Create an account to start meeting securely.' : 'Enter your details to continue to your meetings.'}</p>
            </div>

            {(error || authError) && (
              <div className="auth-error" role="alert">{error || authError}</div>
            )}
            {status === 'ready' && authError && (
              <button type="button" className="auth-retry" onClick={refresh}>Retry connection</button>
            )}

            <form className="auth-form" onSubmit={handleSubmit}>
              <label htmlFor="auth-email">Email address</label>
              <div className="auth-input-wrap">
                <FiMail aria-hidden="true" />
                <input
                  id="auth-email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  maxLength={254}
                  required
                  autoFocus
                />
              </div>

              <div className="auth-label-row">
                <label htmlFor="auth-password">Password</label>
                {isSignUp && <span>8 characters minimum</span>}
              </div>
              <div className="auth-input-wrap">
                <FiLock aria-hidden="true" />
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  placeholder={isSignUp ? 'Create a strong password' : 'Enter your password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={8}
                  maxLength={128}
                  required
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>

              {isSignUp && (
                <>
                  <label htmlFor="auth-confirm-password">Confirm password</label>
                  <div className="auth-input-wrap">
                    <FiLock aria-hidden="true" />
                    <input
                      id="auth-confirm-password"
                      type={showPassword ? 'text' : 'password'}
                      name="confirmPassword"
                      autoComplete="new-password"
                      placeholder="Enter your password again"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      minLength={8}
                      maxLength={128}
                      required
                    />
                  </div>
                </>
              )}

              <button className="auth-submit" type="submit" disabled={isSubmitting}>
                <span>{isSubmitting ? 'Please wait…' : isSignUp ? 'Create account' : 'Sign in securely'}</span>
                {!isSubmitting && <FiArrowRight />}
              </button>
            </form>

            <div className="auth-security-note">
              <FiShield />
              <span>Your password is securely hashed and never stored as plain text.</span>
            </div>

            <p className="auth-switch">
              {isSignUp ? 'Already have an account?' : 'New to MeetSpace?'}
              {' '}
              <Link to={isSignUp ? '/login' : '/signup'} state={location.state}>
                {isSignUp ? 'Sign in' : 'Create an account'}
              </Link>
            </p>
          </div>
          <p className="auth-terms">By continuing, you agree to use MeetSpace responsibly and respectfully.</p>
        </section>
      </div>

      <footer className="auth-footer">
        <span>© {new Date().getFullYear()} MeetSpace</span>
        <span>Made for meaningful conversations</span>
      </footer>
    </main>
  );
};

export default Login;
