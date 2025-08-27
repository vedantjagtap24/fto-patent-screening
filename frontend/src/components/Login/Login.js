import React, { useState } from 'react';
import { Eye, EyeOff, Mail } from 'lucide-react';
import { signIn, signUp, supabase } from '../../lib/supabase';
import './Login.css';

const Login = ({ onLogin }) => {
  const [formState, setFormState] = useState({
    email: '', password: '', confirmPassword: '', showPassword: false, showConfirmPassword: false,
    isLoading: false, isSignUp: false, isForgotPassword: false, error: '', successMessage: ''
  });

  const updateFormState = (updates) => setFormState(prev => ({ ...prev, ...updates }));

  const validateInputs = () => {
    const { email, password, confirmPassword, isSignUp, isForgotPassword } = formState;
    
    if (isForgotPassword) {
      if (!email) {
        updateFormState({ error: 'Please enter your email address' });
        return false;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        updateFormState({ error: 'Please enter a valid email address' });
        return false;
      }
      return true;
    }

    if (!email || !password) {
      updateFormState({ error: 'Please fill in all fields' });
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      updateFormState({ error: 'Please enter a valid email address' });
      return false;
    }

    if (isSignUp) {
      if (password.length < 6) {
        updateFormState({ error: 'Password must be at least 6 characters long' });
        return false;
      }
      if (!confirmPassword) {
        updateFormState({ error: 'Please confirm your password' });
        return false;
      }
      if (password !== confirmPassword) {
        updateFormState({ error: 'Passwords do not match' });
        return false;
      }
    }
    return true;
  };

  const checkEmailExists = async (email) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password: 'dummy_check' });
      return error?.message.includes('Invalid login credentials');
    } catch { return false; }
  };

  const handleForgotPassword = async () => {
    if (!validateInputs()) return;
    updateFormState({ isLoading: true, error: '' });
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(formState.email);
      updateFormState({
        [error ? 'error' : 'successMessage']: error?.message || 'Password reset email sent! Check your inbox and follow the instructions.',
        isLoading: false
      });
    } catch (error) {
      updateFormState({ error: 'Failed to send reset email. Please try again.', isLoading: false });
    }
  };

  const getErrorMessage = (error) => {
    const errorMap = {
      'Invalid login credentials': 'Invalid email or password. Please check your credentials and try again.',
      'Email not confirmed': 'Please check your email and click the confirmation link before signing in.',
      'User already registered': 'This email is already registered. Please sign in instead.',
      'Signup not allowed': 'New signups are currently disabled. Please contact support.'
    };
    return Object.keys(errorMap).find(key => error.message.includes(key)) ? errorMap[Object.keys(errorMap).find(key => error.message.includes(key))] : error.message;
  };

  const handleAuth = async () => {
    if (!validateInputs()) return;
    updateFormState({ isLoading: true, error: '', successMessage: '' });
    
    try {
      if (formState.isSignUp && await checkEmailExists(formState.email)) {
        return updateFormState({ error: 'This email is already registered. Please sign in instead or use a different email.', isLoading: false });
      }

      const { data, error } = formState.isSignUp 
        ? await signUp(formState.email, formState.password)
        : await signIn(formState.email, formState.password);

      if (error) return updateFormState({ error: getErrorMessage(error), isLoading: false });
      if (!data?.user) return updateFormState({ error: 'Authentication failed. Please try again.', isLoading: false });

      if (formState.isSignUp) {
        return updateFormState({ 
          successMessage: 'Account created successfully! Please check your email to confirm your account before signing in.',
          isLoading: false, isSignUp: false, password: '', confirmPassword: '', error: ''
        });
      }

      if (data.user && data.session) {
        onLogin({
          user: data.user, session: data.session, email: data.user.email,
          name: data.user.user_metadata?.name || data.user.email?.split('@')[0] || 'User'
        });
      } else {
        updateFormState({ error: 'Authentication incomplete. Please try again.', isLoading: false });
      }
    } catch (error) {
      updateFormState({ error: 'Authentication failed. Please check your connection and try again.', isLoading: false });
    }
  };

  const handleKeyPress = (e) => {
    if (e.key !== 'Enter' || formState.isLoading) return;
    const { email, password, confirmPassword, isSignUp, isForgotPassword } = formState;
    
    if (isForgotPassword ? email : email && password && (!isSignUp || confirmPassword)) {
      isForgotPassword ? handleForgotPassword() : handleAuth();
    }
  };

  const toggleMode = (mode) => {
    const modes = {
      authMode: { isSignUp: !formState.isSignUp, isForgotPassword: false },
      forgotPassword: { isForgotPassword: !formState.isForgotPassword, isSignUp: false },
      backToLogin: { isForgotPassword: false, isSignUp: false }
    };
    updateFormState({ ...modes[mode], error: '', successMessage: '', email: '', password: '', confirmPassword: '' });
  };

  const isAuthDisabled = () => {
    const { isLoading, email, password, confirmPassword, isSignUp, isForgotPassword } = formState;
    return isLoading || (isForgotPassword ? !email : !email || !password || (isSignUp && !confirmPassword));
  };

  const PasswordInput = ({ value, onChange, placeholder, show, onToggle, minLength }) => (
    <div className="password-input-container">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        onKeyPress={handleKeyPress}
        placeholder={placeholder}
        className="form-input"
        minLength={minLength}
        required
      />
      <button type="button" onClick={onToggle} className="password-toggle">
        {show ? <EyeOff size={20} /> : <Eye size={20} />}
      </button>
    </div>
  );

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1 className="login-title">Welcome to FTOlyzer</h1>
          <p className="login-subtitle">
            {formState.isForgotPassword 
              ? 'Enter your email to reset your password'
              : 'Analyze patent claims with smart features and confident clarity.'
            }
          </p>
        </div>

        <div className="login-form">
          {(formState.error || formState.successMessage) && (
            <div className={formState.error ? "error-message" : "success-message"}>
              {formState.error || formState.successMessage}
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

          {!formState.isForgotPassword && (
            <div className="form-group">
              <label className="form-label">Password</label>
              <PasswordInput
                value={formState.password}
                onChange={(e) => updateFormState({ password: e.target.value })}
                placeholder={formState.isSignUp ? "Choose a password (min 6 characters)" : "Enter your password"}
                show={formState.showPassword}
                onToggle={() => updateFormState({ showPassword: !formState.showPassword })}
                minLength={formState.isSignUp ? 6 : undefined}
              />
            </div>
          )}

          {formState.isSignUp && !formState.isForgotPassword && (
            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <PasswordInput
                value={formState.confirmPassword}
                onChange={(e) => updateFormState({ confirmPassword: e.target.value })}
                placeholder="Confirm your password"
                show={formState.showConfirmPassword}
                onToggle={() => updateFormState({ showConfirmPassword: !formState.showConfirmPassword })}
              />
            </div>
          )}

          <button
            onClick={formState.isForgotPassword ? handleForgotPassword : handleAuth}
            disabled={isAuthDisabled()}
            className={`login-btn ${isAuthDisabled() ? 'disabled' : ''}`}
          >
            {formState.isLoading ? (
              <div className="loading-content">
                <div className="spinner"></div>
                {formState.isForgotPassword ? 'Sending Reset Email...' : 
                 formState.isSignUp ? 'Creating Account...' : 'Signing In...'}
              </div>
            ) : (
              <>
                {formState.isForgotPassword && <Mail size={20} style={{ marginRight: '0.5rem' }} />}
                {formState.isForgotPassword ? 'Send Reset Email' : 
                 formState.isSignUp ? 'Create Account' : 'Sign In'}
              </>
            )}
          </button>
        </div>

        <div className="login-footer">
          {formState.isForgotPassword ? (
            <button className="auth-toggle-btn" onClick={() => toggleMode('backToLogin')} disabled={formState.isLoading}>
              Back to Sign In
            </button>
          ) : (
            <>
              <button 
                className="auth-toggle-btn"
                onClick={() => toggleMode('authMode')}
                disabled={formState.isLoading}
                style={{ marginBottom: '0.5rem' }}
              >
                {formState.isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
              </button>
              {!formState.isSignUp && (
                <button 
                  className="auth-toggle-btn forgot-password-btn"
                  onClick={() => toggleMode('forgotPassword')}
                  disabled={formState.isLoading}
                >
                  Forgot your password?
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;