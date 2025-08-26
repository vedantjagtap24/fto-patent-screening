import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { signIn, signUp } from '../../lib/supabase';
import './Login.css';

const Login = ({ onLogin }) => {
  // Consolidated state
  const [formState, setFormState] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    showPassword: false,
    showConfirmPassword: false,
    isLoading: false,
    isSignUp: false,
    error: '',
    successMessage: ''
  });

  // Update form state helper
  const updateFormState = (updates) => {
    setFormState(prev => ({ ...prev, ...updates }));
  };

  // Input validation
  const validateInputs = () => {
    if (!formState.email || !formState.password) {
      updateFormState({ error: 'Please fill in all fields' });
      return false;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formState.email)) {
      updateFormState({ error: 'Please enter a valid email address' });
      return false;
    }

    if (formState.isSignUp) {
      if (formState.password.length < 6) {
        updateFormState({ error: 'Password must be at least 6 characters long' });
        return false;
      }

      if (!formState.confirmPassword) {
        updateFormState({ error: 'Please confirm your password' });
        return false;
      }

      if (formState.password !== formState.confirmPassword) {
        updateFormState({ error: 'Passwords do not match' });
        return false;
      }
    }

    return true;
  };

  // Handlers (consolidated)
  const handleAuth = async () => {
    if (!validateInputs()) return;
    
    updateFormState({ isLoading: true, error: '', successMessage: '' });
    
    try {
      const { data, error } = formState.isSignUp 
        ? await signUp(formState.email, formState.password)
        : await signIn(formState.email, formState.password);

      if (error) {
        console.error('Authentication error:', error);
        
        // Handle specific error messages
        let errorMessage = error.message;
        if (error.message.includes('Invalid login credentials')) {
          errorMessage = 'Invalid email or password. Please check your credentials and try again.';
        } else if (error.message.includes('Email not confirmed')) {
          errorMessage = 'Please check your email and click the confirmation link before signing in.';
        } else if (error.message.includes('User already registered')) {
          errorMessage = 'An account with this email already exists. Please sign in instead.';
        } else if (error.message.includes('Signup not allowed')) {
          errorMessage = 'New signups are currently disabled. Please contact support.';
        } else if (error.message.includes('already registered') || error.message.includes('already exists')) {
          errorMessage = 'This email is already registered. Please sign in or use a different email.';
        }
        
        updateFormState({ error: errorMessage, isLoading: false });
        return;
      }

      // Check if we have valid authentication data
      if (!data || !data.user) {
        updateFormState({ 
          error: 'Authentication failed. Please try again.', 
          isLoading: false 
        });
        return;
      }

      if (formState.isSignUp) {
        updateFormState({ 
          successMessage: 'Account created successfully! Please check your email to confirm your account before signing in.',
          isLoading: false,
          isSignUp: false,
          password: '',
          confirmPassword: ''
        });
        return;
      }

      // Only proceed if we have both user and session
      if (data.user && data.session) {
        console.log('Authentication successful, calling onLogin');
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
      console.error('Authentication error:', error);
      updateFormState({ 
        error: 'Authentication failed. Please check your connection and try again.', 
        isLoading: false 
      });
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !formState.isLoading) {
      if (formState.email && formState.password && (!formState.isSignUp || formState.confirmPassword)) {
        handleAuth();
      }
    }
  };

  const togglePasswordVisibility = () => {
    updateFormState({ showPassword: !formState.showPassword });
  };

  const toggleConfirmPasswordVisibility = () => {
    updateFormState({ showConfirmPassword: !formState.showConfirmPassword });
  };

  const toggleAuthMode = () => {
    updateFormState({ 
      isSignUp: !formState.isSignUp, 
      error: '',
      successMessage: '',
      email: '',
      password: '',
      confirmPassword: ''
    });
  };

  // Check if auth is disabled
  const isAuthDisabled = () => {
    if (formState.isLoading) return true;
    if (formState.isSignUp) return !formState.email || !formState.password || !formState.confirmPassword;
    return !formState.email || !formState.password;
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

          {formState.successMessage && (
            <div className="success-message">
              {formState.successMessage}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              type="email"
              value={formState.email}
              onChange={(e) => updateFormState({ email: e.target.value, error: '', successMessage: '' })}
              onKeyPress={handleKeyPress}
              placeholder="Enter your email"
              className="form-input"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="password-input-container">
              <input
                type={formState.showPassword ? 'text' : 'password'}
                value={formState.password}
                onChange={(e) => updateFormState({ password: e.target.value, error: '', successMessage: '' })}
                onKeyPress={handleKeyPress}
                placeholder={formState.isSignUp ? "Choose a password (min 6 characters)" : "Enter your password"}
                className="form-input"
                minLength={formState.isSignUp ? 6 : undefined}
                required
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

          {formState.isSignUp && (
            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <div className="password-input-container">
                <input
                  type={formState.showConfirmPassword ? 'text' : 'password'}
                  value={formState.confirmPassword}
                  onChange={(e) => updateFormState({ confirmPassword: e.target.value, error: '', successMessage: '' })}
                  onKeyPress={handleKeyPress}
                  placeholder="Confirm your password"
                  className="form-input"
                  required
                />
                <button
                  type="button"
                  onClick={toggleConfirmPasswordVisibility}
                  className="password-toggle"
                >
                  {formState.showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>
          )}

          <button
            onClick={handleAuth}
            disabled={isAuthDisabled()}
            className={`login-btn ${isAuthDisabled() ? 'disabled' : ''}`}
          >
            {formState.isLoading ? (
              <div className="loading-content">
                <div className="spinner"></div>
                {formState.isSignUp ? 'Creating Account...' : 'Signing In...'}
              </div>
            ) : (
              formState.isSignUp ? 'Create Account' : 'Sign In'
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