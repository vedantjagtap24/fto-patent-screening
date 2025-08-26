import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { signIn, signUp } from '../../lib/supabase';
import './Login.css';

const Login = ({ onLogin }) => {
  // Consolidated state
  const [formState, setFormState] = useState({
    email: '',
    password: '',
    showPassword: false,
    isLoading: false,
    isSignUp: false,
    error: ''
  });

  // Update form state helper
  const updateFormState = (updates) => {
    setFormState(prev => ({ ...prev, ...updates }));
  };

  // Handlers (consolidated)
  const handleAuth = async () => {
    if (!formState.email || !formState.password) {
      updateFormState({ error: 'Please fill in all fields' });
      return;
    }
    
    updateFormState({ isLoading: true, error: '' });
    
    try {
      const { data, error } = formState.isSignUp 
        ? await signUp(formState.email, formState.password)
        : await signIn(formState.email, formState.password);

      if (error) {
        updateFormState({ error: error.message, isLoading: false });
        return;
      }

      if (formState.isSignUp && !data.user?.email_confirmed_at) {
        updateFormState({ 
          error: 'Please check your email and click the confirmation link before signing in.',
          isLoading: false,
          isSignUp: false
        });
        return;
      }

      if (data.user && data.session) {
        onLogin({
          user: data.user,
          session: data.session,
          email: data.user.email,
          name: data.user.user_metadata?.name || data.user.email?.split('@')[0] || 'User'
        });
      }
    } catch (error) {
      console.error('Authentication error:', error);
      updateFormState({ 
        error: 'Authentication failed. Please try again.', 
        isLoading: false 
      });
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && formState.email && formState.password && !formState.isLoading) {
      handleAuth();
    }
  };

  const togglePasswordVisibility = () => {
    updateFormState({ showPassword: !formState.showPassword });
  };

  const toggleAuthMode = () => {
    updateFormState({ 
      isSignUp: !formState.isSignUp, 
      error: '',
      email: '',
      password: ''
    });
  };

  // Check if auth is disabled
  const isAuthDisabled = formState.isLoading || !formState.email || !formState.password;

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1 className="login-title">Welcome to FTO Patents</h1>
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
              onChange={(e) => updateFormState({ email: e.target.value, error: '' })}
              onKeyPress={handleKeyPress}
              placeholder="Enter your email"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="password-input-container">
              <input
                type={formState.showPassword ? 'text' : 'password'}
                value={formState.password}
                onChange={(e) => updateFormState({ password: e.target.value, error: '' })}
                onKeyPress={handleKeyPress}
                placeholder={formState.isSignUp ? "Choose a password (min 6 characters)" : "Enter your password"}
                className="form-input"
                minLength={formState.isSignUp ? 6 : undefined}
              />
              <button
                type="button"
                onClick={togglePasswordVisibility}
                className="password-toggle"
              >
                {formState.showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <button
            onClick={handleAuth}
            disabled={isAuthDisabled}
            className={`login-btn ${isAuthDisabled ? 'disabled' : ''}`}
          >
            {formState.isLoading ? (
              <div className="loading-content">
                <div className="spinner"></div>
                {formState.isSignUp ? 'Creating Account...' : 'Logging in...'}
              </div>
            ) : (
              formState.isSignUp ? 'Create Account' : 'Log In'
            )}
          </button>
        </div>

        <div className="login-footer">
          <button 
            className="auth-toggle-btn"
            onClick={toggleAuthMode}
            disabled={formState.isLoading}
          >
            {formState.isSignUp 
              ? 'Already have an account? Sign In' 
              : "Don't have an account? Sign Up"
            }
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;