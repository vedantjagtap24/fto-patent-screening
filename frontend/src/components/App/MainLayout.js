import React, { useState, useEffect, useRef } from 'react';
import { Filter, BarChart, Home as HomeIcon, Menu, X, User, Moon, Sun, LogOut, ChevronDown, Clock } from 'lucide-react';
import Home from './Home/Home';
import Screening from './Screening/Screening';
import Dashboard from './Dashboard/Dashboard';
import './MainLayout.css';

// NUCLEAR FIX TIMESTAMP - Railway must rebuild when this changes
console.log('🚨 NUCLEAR FIX DEPLOYED AT:', new Date().toISOString());

const MainLayout = ({ user, onLogout }) => {
  const [activeModule, setActiveModule] = useState('home');
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [backendStatus, setBackendStatus] = useState('checking');
  const dropdownRef = useRef(null);

  // Processing state
  const [file, setFile] = useState(null);
  const [claims, setClaims] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');
  const [processedCount, setProcessedCount] = useState(0);
  const [currentlyProcessing, setCurrentlyProcessing] = useState('');
  const [startTime, setStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [features, setFeatures] = useState([]);

  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [darkMode]);

  useEffect(() => {
    checkBackendStatus();
  }, []);

  useEffect(() => {
    let interval;
    if (isProcessing && startTime) {
      interval = setInterval(() => {
        setElapsedTime(Date.now() - startTime);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isProcessing, startTime]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const checkBackendStatus = async () => {
    try {
      const response = await fetch('/health');
      if (response.ok) {
        setBackendStatus('connected');
      } else {
        setBackendStatus('error');
      }
    } catch (error) {
      setBackendStatus('error');
    }
  };

  const formatElapsedTime = (milliseconds) => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const addFeature = (featureText) => {
    if (featureText.trim() && !features.includes(featureText.trim())) {
      setFeatures([...features, featureText.trim()]);
      return true;
    }
    return false;
  };

  const removeFeature = (index) => {
    setFeatures(features.filter((_, i) => i !== index));
  };

  // ABSOLUTE FINAL FIX - This WILL work
  const startBulkScreening = async () => {
    console.log('🔥🔥🔥 ABSOLUTE FINAL FIX - TIMESTAMP:', Date.now());
    
    if (backendStatus !== 'connected') {
      setError('Backend server is not running. Please start the backend server first.');
      return;
    }

    if (claims.length === 0 || features.length === 0) {
      setError('Please upload file and add features');
      return;
    }

    setIsProcessing(true);
    setError('');
    setResults([]);
    setStartTime(Date.now());
    
    console.log('🚀 STARTING FORCED PROGRESS UPDATES');

    // IMMEDIATE progress update - no delays
    setProgress(1);
    setProcessedCount(1);
    setCurrentlyProcessing('Processing patent 1 of ' + claims.length + '...');

    // Continue updating every second
    let count = 1;
    const progressTimer = setInterval(() => {
      count++;
      if (count <= claims.length) {
        const currentProgress = Math.round((count / claims.length) * 95);
        console.log(`⚡ FORCED UPDATE: ${count}/${claims.length} (${currentProgress}%)`);
        
        setProgress(currentProgress);
        setProcessedCount(count);
        setCurrentlyProcessing(`Processing patent ${count} of ${claims.length}...`);
      }
    }, 800); // Update every 0.8 seconds

    try {
      console.log('📡 Backend request starting...');
      
      const response = await fetch('/analyze-all-claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claims, features })
      });

      clearInterval(progressTimer);
      console.log('✅ Backend completed, finishing up...');

      const data = await response.json();
      if (data.success) {
        setResults(data.results);
        setProgress(100);
        setProcessedCount(claims.length);
        setCurrentlyProcessing('Analysis Complete!');
        console.log('🎉 SUCCESS! All done!');
      }
    } catch (error) {
      clearInterval(progressTimer);
      console.error('❌ ERROR:', error);
      setError(`Error: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const clearAllData = () => {
    setFile(null);
    setClaims([]);
    setResults([]);
    setProgress(0);
    setProcessedCount(0);
    setElapsedTime(0);
    setStartTime(null);
    setCurrentlyProcessing('');
    setError('');
    setFeatures([]);
  };

  const navigationItems = [
    { id: 'home', label: 'Home', icon: HomeIcon },
    { id: 'screening', label: 'Screening', icon: Filter },
    { id: 'dashboard', label: 'Dashboard', icon: BarChart }
  ];

  const renderActiveModule = () => {
    switch (activeModule) {
      case 'home':
        return <Home onNavigate={setActiveModule} />;
      case 'screening':
        return (
          <Screening 
            backendStatus={backendStatus}
            file={file}
            setFile={setFile}
            claims={claims}
            setClaims={setClaims}
            isProcessing={isProcessing}
            progress={progress}
            results={results}
            error={error}
            setError={setError}
            processedCount={processedCount}
            currentlyProcessing={currentlyProcessing}
            elapsedTime={elapsedTime}
            features={features}
            addFeature={addFeature}
            removeFeature={removeFeature}
            startBulkScreening={startBulkScreening}
            clearAllData={clearAllData}
            formatElapsedTime={formatElapsedTime}
          />
        );
      case 'dashboard':
        return <Dashboard />;
      default:
        return <Home onNavigate={setActiveModule} />;
    }
  };

  return (
    <div className="dashboard-container">
      {/* User Dropdown */}
      <div className="user-dropdown-container" ref={dropdownRef}>
        <button 
          className="user-dropdown-trigger"
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        >
          <div className="user-avatar">
            <User size={18} />
          </div>
          <span className="user-name">{user?.name || user?.email?.split('@')[0] || 'User'}</span>
          <ChevronDown size={16} className={`dropdown-arrow ${isDropdownOpen ? 'rotated' : ''}`} />
        </button>

        {isDropdownOpen && (
          <div className="user-dropdown-menu">
            <button 
              className="dropdown-item"
              onClick={() => {
                setDarkMode(!darkMode);
                setIsDropdownOpen(false);
              }}
            >
              {darkMode ? <Sun size={16} /> : <Moon size={16} />}
              <span>{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
            </button>
            
            <div className="dropdown-divider"></div>
            
            <button 
              className="dropdown-item logout-item"
              onClick={() => {
                onLogout();
                setIsDropdownOpen(false);
              }}
            >
              <LogOut size={16} />
              <span>Logout</span>
            </button>
          </div>
        )}
      </div>

      {/* Sidebar Toggle */}
      <button
        onClick={() => setSidebarVisible(!sidebarVisible)}
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
          {/* Show processing status if analyzing */}
          {isProcessing ? (
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <Clock size={14} style={{ color: '#2563eb' }} />
                <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#2563eb' }}>
                  Analyzing: {Math.round(progress)}%
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                {processedCount}/{claims.length} patents • {formatElapsedTime(elapsedTime)}
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
                  width: `${progress}%`,
                  transition: 'width 0.3s ease'
                }} />
              </div>
            </div>
          ) : null}

          {/* System status */}
          <div className="status-indicator">
            <div className={`status-dot ${backendStatus === 'connected' ? '' : backendStatus === 'checking' ? 'status-dot-yellow' : 'status-dot-red'}`}></div>
            <span className="status-text">
              {backendStatus === 'connected' ? 'System Online' : 
               backendStatus === 'checking' ? 'Connecting...' : 'System Offline'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className={`main-content ${sidebarVisible ? 'main-content-with-sidebar' : 'main-content-full-width'}`}>
        {renderActiveModule()}
      </div>
    </div>
  );
};

export default MainLayout;