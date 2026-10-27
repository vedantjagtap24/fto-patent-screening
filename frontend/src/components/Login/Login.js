import React, { useState } from 'react';
import { Eye, EyeOff, FileSearch, Check, Info } from 'lucide-react';
import { signIn } from '../../lib/supabase';
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

  const highlights = [
    'Screen thousands of patent claims in one run',
    'AI checks every claim against your product features',
    'Claims ranked by overlap so you know where to look first'
  ];

  return (
    <div className="login-page">
      <aside className="login-brand">
        <div className="login-brand-logo">
          <span className="brand-mark"><FileSearch size={18} /></span>
          <span>FTOlyzer</span>
        </div>

        <div className="login-brand-body">
          <h2 className="login-brand-title">Freedom to Operate screening, in hours instead of weeks.</h2>
          <ul className="login-highlights">
            {highlights.map(item => (
              <li key={item}>
                <span className="login-check"><Check size={14} /></span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="login-brand-footer">Preliminary analysis only. Final conclusions should be reviewed by patent counsel.</p>
      </aside>

      <main className="login-main">
        <div className="login-card">
          <div className="login-mobile-logo">
            <span className="brand-mark"><FileSearch size={18} /></span>
            <span>FTOlyzer</span>
          </div>

          <h1 className="login-title">Sign in</h1>
          <p className="login-subtitle">Welcome to FTOlyzer. Analyze patent claims with confidence.</p>

          {DEMO_EMAIL && DEMO_PASSWORD && (
            <div className="demo-note">
              <Info size={16} />
              <span>Demo access: the details are filled in for you. Just click <strong>Sign in</strong>.</span>
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
        </div>
      </main>
    </div>
  );
};

export default Login;
