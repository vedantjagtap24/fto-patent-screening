import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, FileSearch, Info } from 'lucide-react';
import { signIn } from '../../lib/supabase';
import LoginScene from './LoginScene';
import './Login.css';

const PasswordInput = ({ value, onChange, onKeyPress, placeholder, show, onToggle }) => (
  <div className="password-input-container">
    <input
      type={show ? 'text' : 'password'}
      value={value}
      onChange={onChange}
      onKeyPress={onKeyPress}
      placeholder={placeholder}
      className="input form-input"
      required
    />
    <button type="button" onClick={onToggle} className="password-toggle" title={show ? 'Hide password' : 'Show password'}>
      {show ? <EyeOff size={18} /> : <Eye size={18} />}
    </button>
  </div>
);

// Shared demo account, baked in at build time so visitors only need to click Sign In
const DEMO_EMAIL = process.env.REACT_APP_DEMO_EMAIL || '';
const DEMO_PASSWORD = process.env.REACT_APP_DEMO_PASSWORD || '';

const Login = ({ onLogin }) => {
  const [formState, setFormState] = useState({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    showPassword: false,
    isLoading: false,
    error: ''
  });

  const updateFormState = (updates) => setFormState(prev => ({ ...prev, ...updates }));

  const validateInputs = () => {
    const { email, password } = formState;
    
    if (!email || !password) {
      updateFormState({ error: 'Please fill in all fields' });
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      updateFormState({ error: 'Please enter a valid email address' });
      return false;
    }
    return true;
  };

  const getErrorMessage = (error) => {
    const errorMap = {
      'Invalid login credentials': 'Invalid email or password. Please check your credentials and try again.',
      'Email not confirmed': 'Please check your email and click the confirmation link before signing in.',
      'Too many requests': 'Too many sign-in attempts. Please wait a moment and try again.'
    };
    
    const foundKey = Object.keys(errorMap).find(key => error.message.includes(key));
    return foundKey ? errorMap[foundKey] : 'Sign in failed. Please check your credentials and try again.';
  };

  const handleSignIn = async () => {
    if (!validateInputs()) return;
    
    updateFormState({ isLoading: true, error: '' });
    
    try {
      const { data, error } = await signIn(formState.email, formState.password);

      if (error) {
        return updateFormState({ 
          error: getErrorMessage(error), 
          isLoading: false 
        });
      }
      
      if (!data?.user) {
        return updateFormState({ 
          error: 'Authentication failed. Please try again.', 
          isLoading: false 
        });
      }

      if (data.user && data.session) {
        onLogin({
          user: data.user,
          session: data.session,
          email: data.user.email,
          name: data.user.user_metadata?.name || data.user.email?.split('@')[0] || 'User'
        });
      } else {
        updateFormState({ 
          error: 'Authentication incomplete. Please try again.', 
          isLoading: false 
        });
      }
    } catch (error) {
      updateFormState({ 
        error: 'Authentication failed. Please check your connection and try again.', 
        isLoading: false 
      });
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !formState.isLoading && formState.email && formState.password) {
      handleSignIn();
    }
  };

  const isSignInDisabled = () => {
    return formState.isLoading || !formState.email || !formState.password;
  };

  // Numbers about the latest completed run, so this page always matches the data
  const [summary, setSummary] = useState(null);
  useEffect(() => {
    fetch('/api/public/summary')
      .then(response => response.json())
      .then(setSummary)
      .catch(() => setSummary({ available: false }));
  }, []);

  const stats = summary?.available ? [
    { value: summary.patents.toLocaleString(), label: 'patents screened' },
    { value: summary.features.length, label: summary.features.length === 1 ? 'product feature' : 'product features' },
    { value: summary.highPriority.toLocaleString(), label: 'high-priority patents' }
  ] : [];

  return (
    <div className="login-page">
      <div className="login-glow login-glow-1" />
      <div className="login-glow login-glow-2" />

      <header className="login-header">
        <span className="brand-mark"><FileSearch size={18} /></span>
        <span>FTOlyzer</span>
      </header>

      <div className="login-layout">
        <section className="login-hero">
          <span className="login-eyebrow">AI patent clearance</span>
          <h2 className="login-hero-title">
            Freedom to Operate screening, <em>in minutes</em> instead of weeks.
          </h2>
          <p className="login-hero-text">
            Upload thousands of patent claims, describe your product, and FTOlyzer checks every claim
            against every feature, then ranks the ones that could block you.
          </p>
          <dl className={`login-stats ${stats.length ? 'is-ready' : ''}`}>
            {stats.map(stat => (
              <div key={stat.label}>
                <dt>{stat.value}</dt>
                <dd>{stat.label}</dd>
              </div>
            ))}
          </dl>
          <LoginScene summary={summary} />
        </section>

        <main className="login-card">
          <h1 className="login-title">Sign in</h1>
          <p className="login-subtitle">
            {summary?.available
              ? `See a completed screening of ${summary.patents.toLocaleString()} patents against ${summary.features.length} product features.`
              : 'Sign in to screen patent claims against your product features.'}
          </p>

          {DEMO_EMAIL && DEMO_PASSWORD && (
            <div className="demo-note">
              <Info size={16} />
              <span>Demo access is filled in. Just click <strong>Sign in</strong>.</span>
            </div>
          )}

          <div className="login-form">
            {formState.error && (
              <div className="login-error">
                {formState.error}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                value={formState.email}
                onChange={(e) => updateFormState({ email: e.target.value })}
                onKeyPress={handleKeyPress}
                placeholder="you@company.com"
                className="input form-input"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <PasswordInput
                value={formState.password}
                onChange={(e) => updateFormState({ password: e.target.value })}
                onKeyPress={handleKeyPress}
                placeholder="Enter your password"
                show={formState.showPassword}
                onToggle={() => updateFormState({ showPassword: !formState.showPassword })}
              />
            </div>

            <button
              onClick={handleSignIn}
              disabled={isSignInDisabled()}
              className="btn btn-primary btn-lg login-btn"
            >
              {formState.isLoading ? (
                <>
                  <span className="spinner" />
                  Signing in…
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </div>

          <p className="login-disclaimer">Preliminary analysis only. Final conclusions should be reviewed by patent counsel.</p>
        </main>
      </div>

      <footer className="login-footer">
        Developed by <strong>Vedant Jagtap</strong> ·{' '}
        <a href="mailto:vsj7589@nyu.edu">vsj7589@nyu.edu</a> ·{' '}
        <a href="https://github.com/vedantjagtap24/ftolyzer" target="_blank" rel="noopener noreferrer">GitHub</a>
      </footer>
    </div>
  );
};

export default Login;
