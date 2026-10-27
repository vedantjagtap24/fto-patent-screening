import React, { useState, useEffect, useRef } from 'react';
import { Filter, BarChart3, Home as HomeIcon, Moon, Sun, LogOut, Clock, FileSearch, ChevronDown } from 'lucide-react';
import { supabase, signOut } from '../../lib/supabase';
import Home from './Home/Home';
import Screening from './Screening/Screening';
import Dashboard from './Dashboard/Dashboard';
import './MainLayout.css';

const MainLayout = ({ user, session, onLogout }) => {
  // UI State
  const [activeModule, setActiveModule] = useState('home');
  const [darkMode, setDarkMode] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [backendStatus, setBackendStatus] = useState('checking');
  const [analysisLocked, setAnalysisLocked] = useState(false);
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
    elapsedTime: 0,
    phase: null,
    notice: '',
    progressTotal: 0,
    etaMs: null,
    resumable: false,
    runFailed: 0,
    lastFailure: null,
    throttled: false,
    dataLoading: true,
    claimsFromServer: false
  });
  const cancelRequested = useRef(false);
  // Where the time-remaining estimate is measured from; excludes upload time
  const rateStart = useRef(null);
  // Claim text fetched for export, kept so later exports don't download it again
  const claimTexts = useRef(null);

  // Effects (consolidated)
  useEffect(() => {
    checkBackendStatus();
    loadUserData();
  }, []);

  useEffect(() => {
    document.body.classList.toggle('dark-mode', darkMode);
    
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

  // A run that is no longer going: show the results so far and offer to resume
  const showStoppedRun = async (id, { status, processed, total, message }, preloaded) => {
    const resultsData = preloaded || (processed > 0 ? await apiCall(`/api/projects/${id}/results`) : { results: [] });
    const results = resultsData.results || [];
    const finished = status === 'completed';
    const notices = {
      draft: `Analysis cancelled after ${processed} of ${total} patents. Click Resume to continue where it stopped.`,
      interrupted: `Your analysis was interrupted (the server restarted) after ${processed} of ${total} patents. Click Resume to continue where it stopped.`,
      error: message || `The analysis stopped after ${processed} of ${total} patents. Click Resume to continue.`
    };

    updateAppState({
      results,
      progress: finished ? 100 : (total ? Math.round((processed / total) * 100) : 0),
      processedCount: processed,
      progressTotal: total,
      currentlyProcessing: finished ? 'Analysis complete' : '',
      isProcessing: false,
      phase: null,
      etaMs: null,
      // Resume also retries failed claims, so offer it when any failed
      resumable: total > 0 && (processed < total || results.some(r => r.detailed_analysis?.feature_1?.reasoning?.startsWith('Analysis failed'))),
      notice: finished ? '' : notices[status] || ''
    });
  };

  // While the server analyzes in the background, poll its real progress
  const projectId = appState.currentProject?.id;
  useEffect(() => {
    if (!appState.isProcessing || appState.phase !== 'analyzing' || !projectId) return;

    let cancelled = false;
    let polls = 0;
    const poll = async () => {
      try {
        const data = await apiCall(`/api/projects/${projectId}/status`);
        if (cancelled) return;

        const { status, processed, total, failed, lastFailure, throttled } = data;
        if (status === 'processing' || status === 'cancelling') {
          const now = Date.now();
          if (!rateStart.current) rateStart.current = { time: now, processed };
          const doneSinceStart = processed - rateStart.current.processed;
          const etaMs = doneSinceStart > 0
            ? ((now - rateStart.current.time) / doneSinceStart) * (total - processed)
            : null;

          // Refresh the results table every 30s so it fills in while the run goes
          if (polls++ % 6 === 0) {
            const resultsData = await apiCall(`/api/projects/${projectId}/results`);
            if (cancelled) return;
            updateAppState({ results: resultsData.results || [] });
          }

          updateAppState({
            progress: total ? Math.min(99, Math.round((processed / total) * 100)) : 0,
            processedCount: processed,
            progressTotal: total,
            runFailed: failed || 0,
            lastFailure: lastFailure || null,
            throttled: !!throttled,
            etaMs,
            currentlyProcessing: status === 'cancelling'
              ? 'Cancelling after the claims in progress finish…'
              : `Analyzing patent ${Math.min(processed + 1, total)} of ${total}…`
          });
        } else {
          await showStoppedRun(projectId, data);
        }
      } catch (error) {
        console.error('Status check failed:', error);
      }
    };

    poll();
    const interval = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [appState.isProcessing, appState.phase, projectId]);

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
      const health = await response.json();
      setAnalysisLocked(!!health.analysisLocked);
    } catch (error) {
      setBackendStatus('error');
    }
  };

  const loadUserData = async () => {
    try {
      if (!session) return;

      const projectsData = await apiCall('/api/projects');
      const latestProject = projectsData.success && projectsData.projects[0];
      if (!latestProject) return;

      // Everything for the latest project loads at once. Claims come without their
      // text, which is only fetched when it's needed (export).
      const base = `/api/projects/${latestProject.id}`;
      const [featuresData, claimsData, statusData, resultsData] = await Promise.all([
        apiCall(`${base}/features`),
        apiCall(`${base}/claims`),
        apiCall(`${base}/status`),
        apiCall(`${base}/results`)
      ]);

      setAppState(prev => ({
        ...prev,
        currentProject: latestProject,
        features: featuresData.success ? featuresData.features.map(f => f.name) : [],
        claims: claimsData.success ? claimsData.claims.map(c => ({
          'S.No.': c.claim_number,
          'Publication Number': c.publication_number
        })) : [],
        claimsFromServer: true
      }));

      // A run still going is picked up by polling; otherwise show its results
      if (statusData.status === 'processing') {
        rateStart.current = null;
        updateAppState({ isProcessing: true, phase: 'analyzing', startTime: Date.now(), elapsedTime: 0 });
      } else if (statusData.processed > 0 || statusData.status === 'interrupted') {
        await showStoppedRun(latestProject.id, statusData, resultsData);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      updateAppState({ dataLoading: false });
    }
  };

  // Full claim text for export, fetched on demand when claims came from the server
  const loadClaimTexts = async () => {
    const projectId = appState.currentProject.id;
    if (claimTexts.current?.projectId !== projectId) {
      const data = await apiCall(`/api/projects/${projectId}/claims?full=1`);
      claimTexts.current = { projectId, texts: new Map(data.claims.map(c => [c.claim_number, c.claims_text])) };
    }
    return claimTexts.current.texts;
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
      updateAppState({ features: [...appState.features, trimmed], resumable: false });
      return true;
    }
    return false;
  };

  const removeFeature = (index) => {
    updateAppState({ 
      features: appState.features.filter((_, i) => i !== index),
      resumable: false
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

  // Sent in chunks so large spreadsheets don't hit request size or time limits
  const CLAIMS_CHUNK_SIZE = 200;
  const saveClaims = async (projectId, claims, onProgress) => {
    for (let offset = 0; offset < claims.length && !cancelRequested.current; offset += CLAIMS_CHUNK_SIZE) {
      await apiCall(`/api/projects/${projectId}/claims`, 'POST', {
        claims: claims.slice(offset, offset + CLAIMS_CHUNK_SIZE),
        append: offset > 0,
        offset
      });
      onProgress(Math.min(offset + CLAIMS_CHUNK_SIZE, claims.length));
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

    const total = appState.claims.length;
    cancelRequested.current = false;
    rateStart.current = null;
    updateAppState({
      isProcessing: true,
      phase: 'uploading',
      error: '',
      notice: '',
      resumable: false,
      etaMs: null,
      progressTotal: total,
      runFailed: 0,
      lastFailure: null,
      results: [],
      startTime: Date.now(),
      elapsedTime: 0,
      progress: 0,
      processedCount: 0,
      currentlyProcessing: 'Preparing your project…'
    });

    try {
      let project = appState.currentProject;

      // Create project if it doesn't exist
      if (!project) {
        project = await createProject();
        if (!project) {
          updateAppState({ isProcessing: false, phase: null });
          return;
        }
      }

      await saveFeatures(project.id, appState.features);
      if (!appState.claimsFromServer) {
        await saveClaims(project.id, appState.claims, (saved) => {
          updateAppState({ currentlyProcessing: `Uploading claims: ${saved} of ${total}…` });
        });
      }

      if (cancelRequested.current) {
        updateAppState({ isProcessing: false, phase: null, currentlyProcessing: '', notice: 'Analysis cancelled before it started. Nothing was analyzed.' });
        return;
      }

      // The server answers right away and keeps analyzing; progress comes from polling
      await apiCall(`/api/projects/${project.id}/analyze`, 'POST');
      updateAppState({
        currentProject: project,
        phase: 'analyzing',
        currentlyProcessing: `Analyzing patent 1 of ${total}…`
      });
    } catch (error) {
      console.error('Analysis error:', error);
      updateAppState({ 
        error: `Error: ${error.message}`,
        isProcessing: false,
        phase: null
      });
    }
  };

  // Continue a stopped run on the server, keeping the results it already has
  const resumeAnalysis = async () => {
    if (!appState.currentProject) return;

    cancelRequested.current = false;
    rateStart.current = null;
    try {
      await apiCall(`/api/projects/${appState.currentProject.id}/analyze`, 'POST', { resume: true });
      updateAppState({
        isProcessing: true,
        phase: 'analyzing',
        error: '',
        notice: '',
        resumable: false,
        etaMs: null,
        runFailed: 0,
        lastFailure: null,
        results: [],
        startTime: Date.now(),
        elapsedTime: 0,
        currentlyProcessing: 'Resuming…'
      });
    } catch (error) {
      updateAppState({ error: `Could not resume: ${error.message}` });
    }
  };

  const cancelAnalysis = async () => {
    cancelRequested.current = true;
    updateAppState({ currentlyProcessing: 'Cancelling…' });

    // While uploading, the upload loop sees the flag and stops on its own
    if (appState.phase !== 'analyzing' || !appState.currentProject) return;

    try {
      await apiCall(`/api/projects/${appState.currentProject.id}/cancel`, 'POST');
    } catch (error) {
      updateAppState({ error: `Could not cancel: ${error.message}` });
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
      isProcessing: false,
      phase: null,
      notice: '',
      progressTotal: 0,
      etaMs: null,
      resumable: false,
      runFailed: 0,
      lastFailure: null,
      claimsFromServer: false
    });
  };

  // Navigation items
  const navigationItems = [
    { id: 'home', label: 'Overview', icon: HomeIcon, subtitle: 'How FTOlyzer screens patents for you' },
    { id: 'screening', label: 'Screening', icon: Filter, subtitle: 'Upload claims, define features and run the analysis' },
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3, subtitle: 'Insights across your analyses' }
  ];
  const activeItem = navigationItems.find(item => item.id === activeModule) || navigationItems[0];

  const displayName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'User';
  const initials = displayName.slice(0, 2).toUpperCase();

  // Component render functions
  const renderActiveModule = () => {
    const moduleProps = {
      backendStatus,
      ...appState,
      setFile: (file) => updateAppState({ file }),
      setClaims: (claims) => updateAppState({ claims, resumable: false, claimsFromServer: false }),
      setError: (error) => updateAppState({ error }),
      addFeature,
      removeFeature,
      analysisLocked,
      loadClaimTexts,
      startBulkScreening,
      resumeAnalysis,
      cancelAnalysis,
      clearAllData,
      formatElapsedTime
    };

    switch (activeModule) {
      case 'home': return <Home onNavigate={setActiveModule} analysisLocked={analysisLocked} />;
      case 'screening': return <Screening {...moduleProps} />;
      case 'dashboard': return <Dashboard onNavigate={setActiveModule} />;
      default: return <Home onNavigate={setActiveModule} />;
    }
  };

  const toggleDropdown = () => setIsDropdownOpen(!isDropdownOpen);
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

  const statusLabel = backendStatus === 'connected' ? 'All systems online' :
                      backendStatus === 'checking' ? 'Connecting…' : 'Server offline';

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark">
            <FileSearch size={18} />
          </div>
          <span className="brand-name">FTOlyzer</span>
        </div>
        
        <nav className="sidebar-nav">
          <span className="nav-section-label">Workspace</span>
          {navigationItems.map((item) => {
            const IconComponent = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveModule(item.id)}
                className={`nav-item ${activeModule === item.id ? 'nav-item-active' : ''}`}
              >
                <IconComponent size={18} className="nav-icon" />
                <span className="nav-label">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          {/* Processing status */}
          {appState.isProcessing && (
            <div className="processing-card">
              <div className="processing-header">
                <Clock size={14} />
                <span>Analyzing · {Math.round(appState.progress)}%</span>
              </div>
              <div className="processing-bar">
                <div className="processing-fill" style={{ width: `${appState.progress}%` }} />
              </div>
              <div className="processing-details">
                {appState.processedCount}/{appState.claims.length} patents · {formatElapsedTime(appState.elapsedTime)}
              </div>
            </div>
          )}

          {/* System status */}
          <div className="status-indicator">
            <span className={`status-dot status-${backendStatus}`} />
            <span>{statusLabel}</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="main-area">
        <header className="top-header">
          <div className="header-title">
            <h1>{activeItem.label}</h1>
            <p>{activeItem.subtitle}</p>
          </div>

          <div className="header-actions">
            <button className="icon-btn" onClick={toggleDarkMode} title={darkMode ? 'Light mode' : 'Dark mode'}>
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <div className="user-menu" ref={dropdownRef}>
              <button className="user-trigger" onClick={toggleDropdown}>
                <span className="user-avatar">{initials}</span>
                <span className="user-name">{displayName}</span>
                <ChevronDown size={16} className="user-chevron" />
              </button>

              {isDropdownOpen && (
                <div className="user-dropdown">
                  <div className="dropdown-user-info">
                    <span className="dropdown-username">{displayName}</span>
                    <span className="dropdown-email">{user?.email}</span>
                  </div>
                  <button className="dropdown-item" onClick={toggleDarkMode}>
                    {darkMode ? <Sun size={16} /> : <Moon size={16} />}
                    <span>{darkMode ? 'Light mode' : 'Dark mode'}</span>
                  </button>
                  <button className="dropdown-item dropdown-item-danger" onClick={handleLogout}>
                    <LogOut size={16} />
                    <span>Sign out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Mobile navigation */}
        <nav className="mobile-nav">
          {navigationItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveModule(item.id)}
              className={`mobile-nav-item ${activeModule === item.id ? 'active' : ''}`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <main className="main-content">
          <div className="content-wrapper">
            {renderActiveModule()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
