import React, { useState, useEffect, useRef } from 'react';
import { Filter, BarChart, Home as HomeIcon, Menu, X, User, Moon, Sun, LogOut, ChevronDown, Clock } from 'lucide-react';
import { supabase, signOut } from '../../lib/supabase';
import Home from './Home/Home';
import Screening from './Screening/Screening';
import Dashboard from './Dashboard/Dashboard';
import './MainLayout.css';

const MainLayout = ({ user, session, onLogout }) => {
  // UI State
  const [activeModule, setActiveModule] = useState('home');
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [backendStatus, setBackendStatus] = useState('checking');
  const dropdownRef = useRef(null);

  // Project and Processing State (consolidated)
  const [appState, setAppState] = useState({
    currentProject: null,
    file: null,
    claims: [],
    features: [],
    isProcessing: false,
    progress: 0,
    results: [],
    error: '',
    processedCount: 0,
    currentlyProcessing: '',
    startTime: null,
    elapsedTime: 0
  });

  // Effects (consolidated)
  useEffect(() => {
    document.body.classList.toggle('dark-mode', darkMode);
    checkBackendStatus();
    loadUserData();
    
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
    if (appState.isProcessing && appState.startTime) {
      interval = setInterval(() => {
        setAppState(prev => ({
          ...prev,
          elapsedTime: Date.now() - prev.startTime
        }));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [appState.isProcessing, appState.startTime]);

  // API Helper
  const apiCall = async (endpoint, method = 'GET', body = null) => {
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`
    };

    const config = {
      method,
      headers
    };

    if (body) {
      config.body = JSON.stringify(body);
    }

    const response = await fetch(endpoint, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.message || 'API request failed');
    }

    return data;
  };

  const checkBackendStatus = async () => {
    try {
      const response = await fetch('/health');
      setBackendStatus(response.ok ? 'connected' : 'error');
    } catch (error) {
      setBackendStatus('error');
    }
  };

  const loadUserData = async () => {
    try {
      if (!session) return;

      // Get user's projects
      const projectsData = await apiCall('/api/projects');
      
      if (projectsData.success && projectsData.projects.length > 0) {
        // Load the most recent project
        const latestProject = projectsData.projects[0];
        
        // Load project features
        const featuresData = await apiCall(`/api/projects/${latestProject.id}/features`);
        const features = featuresData.success ? featuresData.features.map(f => f.name) : [];
        
        // Load project claims
        const claimsData = await apiCall(`/api/projects/${latestProject.id}/claims`);
        const claims = claimsData.success ? claimsData.claims.map(c => ({
          'S.No.': c.claim_number,
          'Publication Number': c.publication_number,
          'Claims': c.claims_text,
          ...c.raw_data
        })) : [];
        
        // Load analysis results if project is completed
        let results = [];
        if (latestProject.status === 'completed') {
          const resultsData = await apiCall(`/api/projects/${latestProject.id}/results`);
          if (resultsData.success) {
            results = resultsData.results;
          }
        }

        setAppState(prev => ({
          ...prev,
          currentProject: latestProject,
          features,
          claims,
          results,
          isProcessing: latestProject.status === 'processing'
        }));
      }
    } catch (error) {
      console.error('Error loading user data:', error);
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
  const updateAppState = (updates) => {
    setAppState(prev => ({ ...prev, ...updates }));
  };

  const addFeature = (featureText) => {
    const trimmed = featureText.trim();
    if (trimmed && !appState.features.includes(trimmed)) {
      updateAppState({ features: [...appState.features, trimmed] });
      return true;
    }
    return false;
  };

  const removeFeature = (index) => {
    updateAppState({ 
      features: appState.features.filter((_, i) => i !== index) 
    });
  };

  const createProject = async () => {
    try {
      const projectData = await apiCall('/api/projects', 'POST', {
        name: `Analysis Project ${new Date().toLocaleDateString()}`,
        description: 'Patent analysis project'
      });

      if (projectData.success) {
        updateAppState({ currentProject: projectData.project });
        return projectData.project;
      }
    } catch (error) {
      console.error('Error creating project:', error);
      updateAppState({ error: 'Failed to create project: ' + error.message });
      return null;
    }
  };

  const saveFeatures = async (projectId, features) => {
    try {
      await apiCall(`/api/projects/${projectId}/features`, 'POST', { features });
    } catch (error) {
      console.error('Error saving features:', error);
      throw error;
    }
  };

  const saveClaims = async (projectId, claims) => {
    try {
      await apiCall(`/api/projects/${projectId}/claims`, 'POST', { claims });
    } catch (error) {
      console.error('Error saving claims:', error);
      throw error;
    }
  };

  const startBulkScreening = async () => {
    if (backendStatus !== 'connected') {
      updateAppState({ error: 'Backend server is not running. Please start the backend server first.' });
      return;
    }

    if (appState.claims.length === 0 || appState.features.length === 0) {
      updateAppState({ error: 'Please upload file and add features' });
      return;
    }

    try {
      let project = appState.currentProject;

      // Create project if it doesn't exist
      if (!project) {
        project = await createProject();
        if (!project) return;
      }

      // Save features and claims to database
      await saveFeatures(project.id, appState.features);
      await saveClaims(project.id, appState.claims);

      updateAppState({
        isProcessing: true,
        error: '',
        results: [],
        startTime: Date.now(),
        progress: 1,
        processedCount: 1,
        currentlyProcessing: `Processing patent 1 of ${appState.claims.length}...`
      });

      // Simulate progress updates
      let count = 1;
      const progressTimer = setInterval(() => {
        count++;
        if (count <= appState.claims.length) {
          updateAppState({
            progress: Math.round((count / appState.claims.length) * 95),
            processedCount: count,
            currentlyProcessing: `Processing patent ${count} of ${appState.claims.length}...`
          });
        }
      }, 800);

      // Start analysis
      const analysisData = await apiCall(`/api/projects/${project.id}/analyze`, 'POST');

      clearInterval(progressTimer);

      if (analysisData.success) {
        updateAppState({
          results: analysisData.results,
          progress: 100,
          processedCount: appState.claims.length,
          currentlyProcessing: 'Analysis Complete!',
          isProcessing: false
        });
      }
    } catch (error) {
      console.error('Analysis error:', error);
      updateAppState({ 
        error: `Error: ${error.message}`,
        isProcessing: false
      });
    }
  };

  const clearAllData = () => {
    setAppState({
      currentProject: null,
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
      ...appState,
      setFile: (file) => updateAppState({ file }),
      setClaims: (claims) => updateAppState({ claims }),
      setError: (error) => updateAppState({ error }),
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
  
  const handleLogout = async () => {
    try {
      await signOut();
      onLogout();
      setIsDropdownOpen(false);
    } catch (error) {
      console.error('Logout error:', error);
    }
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
            {user?.user_metadata?.name || user?.email?.split('@')[0] || 'User'}
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
          {appState.isProcessing && (
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
                  Analyzing: {Math.round(appState.progress)}%
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                {appState.processedCount}/{appState.claims.length} patents • {formatElapsedTime(appState.elapsedTime)}
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
                  width: `${appState.progress}%`,
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