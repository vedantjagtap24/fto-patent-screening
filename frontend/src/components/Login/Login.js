import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import './Login.css';

const Login = ({ onLogin }) => {
  // Consolidated state
  const [formState, setFormState] = useState({
    email: '',
    password: '',
    showPassword: false,
    isLoading: false
  });

  // Update form state helper
  const updateFormState = (updates) => {
    setFormState(prev => ({ ...prev, ...updates }));
  };

  // Handlers (consolidated)
  const handleLogin = () => {
    if (!formState.email || !formState.password) return;
    
    updateFormState({ isLoading: true });
    setTimeout(() => {
      updateFormState({ isLoading: false });
      onLogin({ 
        email: formState.email, 
        name: formState.email.split('@')[0] 
      });
    }, 1500);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && formState.email && formState.password && !formState.isLoading) {
      handleLogin();
    }
  };

  const togglePasswordVisibility = () => {
    updateFormState({ showPassword: !formState.showPassword });
  };

  // Check if login is disabled
  const isLoginDisabled = formState.isLoading || !formState.email || !formState.password;

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
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              type="email"
              value={formState.email}
              onChange={(e) => updateFormState({ email: e.target.value })}
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
                onChange={(e) => updateFormState({ password: e.target.value })}
                onKeyPress={handleKeyPress}
                placeholder="Enter your password"
                className="form-input"
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
            onClick={handleLogin}
            disabled={isLoginDisabled}
            className={`login-btn ${isLoginDisabled ? 'disabled' : ''}`}
          >
            {formState.isLoading ? (
              <div className="loading-content">
                <div className="spinner"></div>
                Logging in...
              </div>
            ) : (
              'Log In'
            )}
          </button>
        </div>

        <div className="login-footer">
          <button className="forgot-password-btn">
            Forgot your password?
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;