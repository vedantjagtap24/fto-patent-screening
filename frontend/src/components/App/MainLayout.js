import React, { useState, useEffect, useRef } from 'react';
import { Filter, BarChart, Home as HomeIcon, Menu, X, User, Moon, Sun, LogOut, ChevronDown, Clock } from 'lucide-react';
import Home from './Home/Home';
import Screening from './Screening/Screening';
import Dashboard from './Dashboard/Dashboard';
import './MainLayout.css';

const MainLayout = ({ user, onLogout }) => {
  const [activeModule, setActiveModule] = useState('home');
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [backendStatus, setBackendStatus] = useState('checking');
  const dropdownRef = useRef(null);

  // MOVED FROM SCREENING: All processing state
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
  
  // NEW: SSE connection ref
  const eventSourceRef = useRef(null);

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

  // MOVED FROM SCREENING: Timer for elapsed time
  useEffect(() => {
    let interval;
    if (isProcessing && startTime) {
      interval = setInterval(() => {
        setElapsedTime(Date.now() - startTime);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isProcessing, startTime]);

  // Close dropdown when clicking outside
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

  // NEW: Cleanup SSE connection on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
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

  // MOVED FROM SCREENING: Format elapsed time
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

  // MOVED FROM SCREENING: Add feature
  const addFeature = (featureText) => {
    if (featureText.trim() && !features.includes(featureText.trim())) {
      setFeatures([...features, featureText.trim()]);
      return true;
    }
    return false;
  };

  // MOVED FROM SCREENING: Remove feature
  const removeFeature = (index) => {
    setFeatures(features.filter((_, i) => i !== index));
  };

  // UPDATED: New SSE-based bulk screening with real-time progress
  const startBulkScreening = async () => {
    if (backendStatus !== 'connected') {
      setError('Backend server is not running. Please start the backend server first.');
      return;
    }

    if (claims.length === 0) {
      setError('Please upload an Excel file with patent claims');
      return;
    }

    if (features.length === 0) {
      setError('Please add at least one feature to analyze');
      return;
    }

    // Close any existing SSE connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setIsProcessing(true);
    setError('');
    setResults([]);
    setProgress(0);
    setProcessedCount(0);
    setStartTime(Date.now());
    setCurrentlyProcessing(`Initializing analysis of ${claims.length} patents...`);

    try {
      // Create SSE connection with POST data as query params
      const queryParams = new URLSearchParams({
        claims: JSON.stringify(claims),
        features: JSON.stringify(features)
      });
      
      console.log('Starting SSE connection for real-time progress...');
      eventSourceRef.current = new EventSource(`/analyze-stream?${queryParams.toString()}`);
      
      eventSourceRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('SSE Update:', data);
          
          switch (data.type) {
            case 'progress':
              setProgress(data.percentage);
              setProcessedCount(data.processed);
              setCurrentlyProcessing(data.message);
              break;
              
            case 'complete':
              setProgress(100);
              setProcessedCount(data.total);
              setResults(data.results);
              setCurrentlyProcessing('Analysis complete!');
              eventSourceRef.current.close();
              setIsProcessing(false);
              setTimeout(() => setCurrentlyProcessing(''), 3000);
              console.log(`Analysis completed! Processed ${data.total} patents.`);
              break;
              
            case 'error':
              setError(data.message);
              eventSourceRef.current.close();
              setIsProcessing(false);
              console.error('SSE Error:', data.message);
              break;
              
            default:
              console.log('Unknown SSE message type:', data.type);
          }
        } catch (parseError) {
          console.error('Error parsing SSE data:', parseError);
        }
      };
      
      eventSourceRef.current.onerror = (error) => {
        console.error('SSE Connection Error:', error);
        setError('Connection lost during analysis. Please try again.');
        eventSourceRef.current.close();
        setIsProcessing(false);
      };

      eventSourceRef.current.onopen = () => {
        console.log('SSE connection opened successfully');
      };

    } catch (error) {
      console.error('Error starting SSE analysis:', error);
      setError(`Error starting analysis: ${error.message}`);
      setIsProcessing(false);
    }
  };

  // MOVED FROM SCREENING: Clear all data
  const clearAllData = () => {
    // Close SSE connection if active
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    
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
    setIsProcessing(false);
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
            // Pass all processing state and functions
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