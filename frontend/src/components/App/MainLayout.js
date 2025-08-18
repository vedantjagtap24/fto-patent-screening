import React, { useState, useEffect, useRef } from 'react';
import { Filter, BarChart, Home as HomeIcon, Menu, X, User, Moon, Sun, LogOut, ChevronDown, Clock } from 'lucide-react';
import Home from './Home/Home';
import Screening from './Screening/Screening';
import Dashboard from './Dashboard/Dashboard';
import './MainLayout.css';

const MainLayout = ({ user, onLogout }) => {
  // UI State
  const [activeModule, setActiveModule] = useState('home');
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [backendStatus, setBackendStatus] = useState('checking');
  const dropdownRef = useRef(null);

  // Processing State (consolidated)
  const [processingState, setProcessingState] = useState({
    file: null,
    claims: [],
    isProcessing: false,
    progress: 0,
    results: [],
    error: '',
    processedCount: 0,
    currentlyProcessing: '',
    startTime: null,
    elapsedTime: 0,
    features: []
  });

  // Effects (consolidated)
  useEffect(() => {
    document.body.classList.toggle('dark-mode', darkMode);
    checkBackendStatus();
    
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [darkMode]);

  useEffect(() => {
    let interval;
    if (processingState.isProcessing && processingState.startTime) {
      interval = setInterval(() => {
        setProcessingState(prev => ({
          ...prev,
          elapsedTime: Date.now() - prev.startTime
        }));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [processingState.isProcessing, processingState.startTime]);

  const checkBackendStatus = async () => {
    try {
      const response = await fetch('/health');
      setBackendStatus(response.ok ? 'connected' : 'error');
    } catch (error) {
      setBackendStatus('error');
    }
  };

  const formatElapsedTime = (milliseconds) => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  // Processing handlers (consolidated)
  const updateProcessingState = (updates) => {
    setProcessingState(prev => ({ ...prev, ...updates }));
  };

  const addFeature = (featureText) => {
    const trimmed = featureText.trim();
    if (trimmed && !processingState.features.includes(trimmed)) {
      updateProcessingState({ features: [...processingState.features, trimmed] });
      return true;
    }
    return false;
  };

  const removeFeature = (index) => {
    updateProcessingState({ 
      features: processingState.features.filter((_, i) => i !== index) 
    });
  };

  const startBulkScreening = async () => {
    if (backendStatus !== 'connected') {
      updateProcessingState({ error: 'Backend server is not running. Please start the backend server first.' });
      return;
    }

    if (processingState.claims.length === 0 || processingState.features.length === 0) {
      updateProcessingState({ error: 'Please upload file and add features' });
      return;
    }

    updateProcessingState({
      isProcessing: true,
      error: '',
      results: [],
      startTime: Date.now(),
      progress: 1,
      processedCount: 1,
      currentlyProcessing: `Processing patent 1 of ${processingState.claims.length}...`
    });

    let count = 1;
    const progressTimer = setInterval(() => {
      count++;
      if (count <= processingState.claims.length) {
        updateProcessingState({
          progress: Math.round((count / processingState.claims.length) * 95),
          processedCount: count,
          currentlyProcessing: `Processing patent ${count} of ${processingState.claims.length}...`
        });
      }
    }, 800);

    try {
      const response = await fetch('/analyze-all-claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          claims: processingState.claims, 
          features: processingState.features 
        })
      });

      clearInterval(progressTimer);
      const data = await response.json();
      
      if (data.success) {
        updateProcessingState({
          results: data.results,
          progress: 100,
          processedCount: processingState.claims.length,
          currentlyProcessing: 'Analysis Complete!'
        });
      }
    } catch (error) {
      clearInterval(progressTimer);
      console.error('Analysis error:', error);
      updateProcessingState({ error: `Error: ${error.message}` });
    } finally {
      updateProcessingState({ isProcessing: false });
    }
  };

  const clearAllData = () => {
    setProcessingState({
      file: null,
      claims: [],
      results: [],
      progress: 0,
      processedCount: 0,
      elapsedTime: 0,
      startTime: null,
      currentlyProcessing: '',
      error: '',
      features: [],
      isProcessing: false
    });
  };

  // Navigation items
  const navigationItems = [
    { id: 'home', label: 'Home', icon: HomeIcon },
    { id: 'screening', label: 'Screening', icon: Filter },
    { id: 'dashboard', label: 'Dashboard', icon: BarChart }
  ];

  // Component render functions
  const renderActiveModule = () => {
    const moduleProps = {
      backendStatus,
      ...processingState,
      setFile: (file) => updateProcessingState({ file }),
      setClaims: (claims) => updateProcessingState({ claims }),
      setError: (error) => updateProcessingState({ error }),
      addFeature,
      removeFeature,
      startBulkScreening,
      clearAllData,
      formatElapsedTime
    };

    switch (activeModule) {
      case 'home': return <Home onNavigate={setActiveModule} />;
      case 'screening': return <Screening {...moduleProps} />;
      case 'dashboard': return <Dashboard />;
      default: return <Home onNavigate={setActiveModule} />;
    }
  };

  const toggleDropdown = () => setIsDropdownOpen(!isDropdownOpen);
  const toggleSidebar = () => setSidebarVisible(!sidebarVisible);
  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    setIsDropdownOpen(false);
  };
  const handleLogout = () => {
    onLogout();
    setIsDropdownOpen(false);
  };

  return (
    <div className="dashboard-container">
      {/* User Dropdown */}
      <div className="user-dropdown-container" ref={dropdownRef}>
        <button className="user-dropdown-trigger" onClick={toggleDropdown}>
          <div className="user-avatar">
            <User size={18} />
          </div>
          <span className="user-name">
            {user?.name || user?.email?.split('@')[0] || 'User'}
          </span>
          <ChevronDown 
            size={16} 
            className={`dropdown-arrow ${isDropdownOpen ? 'rotated' : ''}`} 
          />
        </button>

        {isDropdownOpen && (
          <div className="user-dropdown-menu">
            <button className="dropdown-item" onClick={toggleDarkMode}>
              {darkMode ? <Sun size={16} /> : <Moon size={16} />}
              <span>{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
            </button>
            <div className="dropdown-divider"></div>
            <button className="dropdown-item logout-item" onClick={handleLogout}>
              <LogOut size={16} />
              <span>Logout</span>
            </button>
          </div>
        )}
      </div>

      {/* Sidebar Toggle */}
      <button
        onClick={toggleSidebar}
        className={`sidebar-toggle-btn ${sidebarVisible ? 'sidebar-toggle-shifted' : ''}`}
        title={sidebarVisible ? 'Hide Sidebar' : 'Show Sidebar'}
      >
        {sidebarVisible ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Sidebar */}
      <div className={`sidebar ${sidebarVisible ? 'sidebar-visible' : 'sidebar-hidden'}`}>
        <div className="sidebar-header">
          <h1 className="sidebar-title">FTOlyzer</h1>
          <p className="sidebar-subtitle">Patent Analysis Platform</p>
        </div>
        
        <nav className="sidebar-nav">
          {navigationItems.map((item) => {
            const IconComponent = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveModule(item.id)}
                className={`nav-item ${activeModule === item.id ? 'nav-item-active' : ''}`}
              >
                <IconComponent size={20} className="nav-icon" />
                <span className="nav-label">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          {/* Processing status */}
          {processingState.isProcessing && (
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem', 
                marginBottom: '0.5rem' 
              }}>
                <Clock size={14} style={{ color: '#2563eb' }} />
                <span style={{ 
                  fontSize: '0.875rem', 
                  fontWeight: '600', 
                  color: '#2563eb' 
                }}>
                  Analyzing: {Math.round(processingState.progress)}%
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                {processingState.processedCount}/{processingState.claims.length} patents • {formatElapsedTime(processingState.elapsedTime)}
              </div>
              <div style={{ 
                width: '100%',
                height: '4px',
                background: '#e5e7eb',
                borderRadius: '2px',
                overflow: 'hidden',
                marginTop: '0.5rem'
              }}>
                <div style={{ 
                  height: '100%',
                  background: 'linear-gradient(to right, #3b82f6, #4f46e5)',
                  width: `${processingState.progress}%`,
                  transition: 'width 0.3s ease'
                }} />
              </div>
            </div>
          )}

          {/* System status */}
          <div className="status-indicator">
            <div className={`status-dot ${
              backendStatus === 'connected' ? '' : 
              backendStatus === 'checking' ? 'status-dot-yellow' : 'status-dot-red'
            }`}></div>
            <span className="status-text">
              {backendStatus === 'connected' ? 'System Online' : 
               backendStatus === 'checking' ? 'Connecting...' : 'System Offline'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className={`main-content ${
        sidebarVisible ? 'main-content-with-sidebar' : 'main-content-full-width'
      }`}>
        {renderActiveModule()}
      </div>
    </div>
  );
};

export default MainLayout;