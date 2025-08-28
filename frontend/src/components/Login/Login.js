import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
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
      className="form-input"
      required
    />
    <button type="button" onClick={onToggle} className="password-toggle">
      {show ? <EyeOff size={20} /> : <Eye size={20} />}
    </button>
  </div>
);

const Login = ({ onLogin }) => {
  const [formState, setFormState] = useState({
    email: '',
    password: '',
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

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1 className="login-title">Welcome to FTOlyzer</h1>
          <p className="login-subtitle">
            Analyze patent claims with smart features and confident clarity.
          </p>
        </div>

        <div className="login-form">
          {formState.error && (
            <div className="error-message">
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
              placeholder="Enter your email"
              className="form-input"
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
            className={`login-btn ${isSignInDisabled() ? 'disabled' : ''}`}
          >
            {formState.isLoading ? (
              <div className="loading-content">
                <div className="spinner"></div>
                Signing In...
              </div>
            ) : (
              'Sign In'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;