// ===== COMPLETE BACKEND UPDATE (server.js) =====

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const OpenAI = require('openai');
require('dotenv').config();

const app = express();
const port = process.env.PORT || process.env.RAILWAY_PORT || 3001;

console.log('Starting server...');
console.log('Using port:', port);
console.log('OpenAI API Key present:', !!process.env.OPENAI_API_KEY);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} from ${req.ip || 'unknown'}`);
  next();
});

app.use(cors());
app.use(express.json({ limit: '100mb' }));

// Determine build path
let buildPath;
const buildPath1 = path.join(__dirname, '../frontend/build');
const buildPath2 = path.join(process.cwd(), 'frontend/build');
const buildPath3 = '/app/frontend/build';
const buildPath4 = path.join(__dirname, 'frontend/build');

if (fs.existsSync(buildPath4)) {
  buildPath = buildPath4;
} else if (fs.existsSync(buildPath1)) {
  buildPath = buildPath1;
} else if (fs.existsSync(buildPath2)) {
  buildPath = buildPath2;
} else if (fs.existsSync(buildPath3)) {
  buildPath = buildPath3;
} else {
  buildPath = buildPath2;
}

console.log('Using build path:', buildPath);

if (fs.existsSync(buildPath)) {
  app.use(express.static(buildPath));
  console.log('Static files middleware added');
}

// Health check endpoint
app.get('/health', (req, res) => {
  console.log('Health check requested');
  try {
    res.status(200).json({ 
      status: 'Backend is running!',
      timestamp: new Date().toISOString(),
      buildExists: fs.existsSync(buildPath),
      port: port,
      env: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    console.error('Error in health check:', error);
    res.status(500).json({ error: 'Health check failed', message: error.message });
  }
});

// NEW: Real-time progress endpoint using Server-Sent Events
app.post('/analyze-all-claims-stream', async (req, res) => {
  try {
    const { claims, features } = req.body;
    console.log(`Starting streaming analysis of ${claims.length} claims with ${features.length} features`);
    
    // Set up Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    const sendProgress = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const results = [];
    const batchSize = 5; // Smaller batches for more frequent updates
    const totalClaims = claims.length;
    
    // Send initial progress
    sendProgress({
      type: 'progress',
      progress: 0,
      processedCount: 0,
      totalCount: totalClaims,
      message: 'Starting analysis...'
    });

    for (let i = 0; i < totalClaims; i += batchSize) {
      const batch = claims.slice(i, i + batchSize);
      const batchNumber = Math.floor(i/batchSize) + 1;
      const totalBatches = Math.ceil(totalClaims/batchSize);
      
      console.log(`Processing batch ${batchNumber}/${totalBatches}`);
      
      // Process each claim in the batch sequentially for real-time updates
      for (let j = 0; j < batch.length; j++) {
        const claim = batch[j];
        const globalIndex = i + j;
        const claimText = claim.Claims || claim.claims || claim.Claim || claim.claim || '';
        const claimNumber = claim['S.No.'] || claim['S.No'] || claim['Claim Number'] || claim['Claim #'] || (globalIndex + 1);
        const publicationNumber = findPublicationNumber(claim);
        
        // Send progress before processing this claim
        sendProgress({
          type: 'processing_claim',
          progress: Math.round((globalIndex / totalClaims) * 100),
          processedCount: globalIndex,
          totalCount: totalClaims,
          message: `Analyzing patent ${claimNumber}...`,
          currentClaim: claimNumber
        });
        
        try {
          const analysis = await analyzeSingleClaim(claimText, claimNumber, features, claims);
          const result = { ...analysis, publicationNumber, index: globalIndex };
          results.push(result);
          
          // Send progress after completing this claim
          sendProgress({
            type: 'claim_completed',
            progress: Math.round(((globalIndex + 1) / totalClaims) * 100),
            processedCount: globalIndex + 1,
            totalCount: totalClaims,
            message: `Completed patent ${claimNumber}`,
            claimNumber: claimNumber
          });
          
        } catch (error) {
          console.error(`Error processing claim ${claimNumber}:`, error);
          const errorResult = createErrorResult(claimNumber, features, publicationNumber, globalIndex);
          results.push(errorResult);
          
          sendProgress({
            type: 'claim_error',
            progress: Math.round(((globalIndex + 1) / totalClaims) * 100),
            processedCount: globalIndex + 1,
            totalCount: totalClaims,
            message: `Error processing patent ${claimNumber}`,
            claimNumber: claimNumber,
            error: error.message
          });
        }
        
        // Small delay between claims to prevent rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Send batch completion
      const completedSoFar = i + batch.length;
      sendProgress({
        type: 'batch_completed',
        progress: Math.round((completedSoFar / totalClaims) * 100),
        processedCount: completedSoFar,
        totalCount: totalClaims,
        message: `Completed batch ${batchNumber}/${totalBatches}`
      });
      
      // Delay between batches
      if (i + batchSize < totalClaims) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    results.sort((a, b) => a.index - b.index);
    const finalResults = results.map(({ index, ...result }) => result);
    
    // Send completion
    sendProgress({
      type: 'completed',
      progress: 100,
      processedCount: totalClaims,
      totalCount: totalClaims,
      message: 'Analysis complete!',
      results: finalResults
    });
    
    console.log(`Streaming analysis completed. Processed ${finalResults.length} claims.`);
    res.end();

  } catch (error) {
    console.error('Error in streaming analysis:', error);
    res.write(`data: ${JSON.stringify({
      type: 'error',
      error: 'Failed to process claims',
      message: error.message
    })}\n\n`);
    res.end();
  }
});

// Keep the original batch endpoint as fallback
app.post('/analyze-all-claims', async (req, res) => {
  try {
    const { claims, features } = req.body;
    console.log(`Starting batch analysis of ${claims.length} claims with ${features.length} features`);
    
    const results = [];
    const batchSize = 10;
    const totalClaims = claims.length;
    
    for (let i = 0; i < totalClaims; i += batchSize) {
      const batch = claims.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(totalClaims/batchSize)}`);
      
      const batchPromises = batch.map(async (claim, batchIndex) => {
        const globalIndex = i + batchIndex;
        const claimText = claim.Claims || claim.claims || claim.Claim || claim.claim || '';
        const claimNumber = claim['S.No.'] || claim['S.No'] || claim['Claim Number'] || claim['Claim #'] || (globalIndex + 1);
        const publicationNumber = findPublicationNumber(claim);
        
        try {
          const analysis = await analyzeSingleClaim(claimText, claimNumber, features, claims);
          return { ...analysis, publicationNumber, index: globalIndex };
        } catch (error) {
          console.error(`Error processing claim ${claimNumber}:`, error);
          return createErrorResult(claimNumber, features, publicationNumber, globalIndex);
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      if (i + batchSize < totalClaims) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    results.sort((a, b) => a.index - b.index);
    const finalResults = results.map(({ index, ...result }) => result);
    
    console.log(`Batch analysis completed. Processed ${finalResults.length} claims.`);
    
    res.json({
      success: true,
      totalProcessed: finalResults.length,
      results: finalResults
    });

  } catch (error) {
    console.error('Error in batch analysis:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process claims batch',
      results: []
    });
  }
});

function findPublicationNumber(claim) {
  const possibleColumns = [
    'Publication Number', 'Publication', 'Pub Number', 'Patent Number',
    'Patent Publication', 'Publication No', 'Pub No', 'Patent No',
    'PublicationNumber', 'PatentNumber'
  ];
  
  for (const col of possibleColumns) {
    if (claim[col] && claim[col] !== 'N/A' && claim[col] !== '') {
      return claim[col];
    }
  }
  
  const columns = Object.keys(claim);
  for (const column of columns) {
    const lowerColumn = column.toLowerCase();
    if ((lowerColumn.includes('publication') || 
         lowerColumn.includes('patent') || 
         lowerColumn.includes('pub')) &&
        claim[column] && 
        claim[column] !== 'N/A' && 
        claim[column] !== '') {
      return claim[column];
    }
  }
  
  return 'N/A';
}

async function analyzeSingleClaim(claim, claimNumber, features, allClaims) {
  const featureList = features.map((feature, index) => `${index + 1}. ${feature}`).join('\n');

  const prompt = `Analyze the following patent claim and determine if it contains the specified features.

FEATURES TO DETECT:
${featureList}

PATENT CLAIM:
${claim}

RESPONSE FORMAT (JSON only):
{
${features.map((feature, index) => `  "feature_${index + 1}": {
    "feature_name": "${feature}",
    "present": true/false,
    "confidence": "High/Medium/Low",
    "reasoning": "Brief explanation",
    "relevant_claims": "If feature is present, list claim numbers (e.g., '1, 2, 3') where this feature appears. If not present, use 'N/A'"
  }`).join(',\n')}
}

IMPORTANT: For relevant_claims, provide only claim numbers (like "1, 2, 3") not the full text content.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: 'You are a patent analysis expert. Always respond with valid JSON. For relevant_claims, provide only claim numbers, not full text.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    max_tokens: 2000,
    temperature: 0.1
  });

  const content = response.choices[0].message.content.trim();
  const analysis = JSON.parse(content);
  
  const result = {
    claimNumber,
    features: features,
    detailed_analysis: analysis
  };

  Object.keys(analysis).forEach(key => {
    result[key] = analysis[key]?.present || false;
  });
  
  return result;
}

function createErrorResult(claimNumber, features, publicationNumber, index) {
  const errorResult = {
    claimNumber,
    publicationNumber,
    features: features,
    detailed_analysis: {},
    index
  };

  features.forEach((feature, featureIndex) => {
    const key = `feature_${featureIndex + 1}`;
    errorResult[key] = false;
    errorResult.detailed_analysis[key] = {
      feature_name: feature,
      present: false,
      confidence: "Low",
      reasoning: "Analysis failed - unable to process claim",
      relevant_claims: "N/A"
    };
  });

  return errorResult;
}

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

app.get('*', (req, res) => {
  let indexPath;
  const indexPath1 = path.join(__dirname, '../frontend/build', 'index.html');
  const indexPath2 = path.join(process.cwd(), 'frontend/build', 'index.html');
  const indexPath3 = '/app/frontend/build/index.html';
  const indexPath4 = path.join(__dirname, 'frontend/build', 'index.html');
  
  if (fs.existsSync(indexPath4)) {
    indexPath = indexPath4;
  } else if (fs.existsSync(indexPath1)) {
    indexPath = indexPath1;
  } else if (fs.existsSync(indexPath2)) {
    indexPath = indexPath2;
  } else if (fs.existsSync(indexPath3)) {
    indexPath = indexPath3;
  } else {
    indexPath = indexPath2;
  }
  
  console.log('Serving index.html for route:', req.path);
  
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send(`Frontend build not found. Tried: ${indexPath}`);
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${port}`);
  console.log('Server started successfully!');
});

// ===== COMPLETE FRONTEND UPDATE (MainLayout.js) =====

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

  // NEW: Real-time progress tracking with Server-Sent Events
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

    setIsProcessing(true);
    setError('');
    setResults([]);
    setProgress(0);
    setProcessedCount(0);
    setStartTime(Date.now());
    setCurrentlyProcessing('Initializing analysis...');

    try {
      console.log('Starting real-time analysis with Server-Sent Events...');

      // Use the streaming endpoint for real-time progress
      const response = await fetch('/analyze-all-claims-stream', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream'
        },
        body: JSON.stringify({
          claims: claims,
          features: features
        })
      });

      if (!response.ok) {
        throw new Error(`Backend Error: ${response.status} ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          console.log('Stream completed');
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              console.log('Received progress update:', data);
              
              switch (data.type) {
                case 'progress':
                case 'processing_claim':
                case 'claim_completed':
                case 'batch_completed':
                  setProgress(data.progress);
                  setProcessedCount(data.processedCount);
                  setCurrentlyProcessing(data.message);
                  if (data.currentClaim) {
                    setCurrentlyProcessing(`Analyzing patent ${data.currentClaim}...`);
                  }
                  break;
                  
                case 'claim_error':
                  setProgress(data.progress);
                  setProcessedCount(data.processedCount);
                  setCurrentlyProcessing(`Error: ${data.message}`);
                  console.warn('Claim processing error:', data.error);
                  break;
                  
                case 'completed':
                  setProgress(100);
                  setProcessedCount(data.totalCount);
                  setCurrentlyProcessing('Analysis complete!');
                  setResults(data.results);
                  
                  // Clear the completion message after 3 seconds
                  setTimeout(() => setCurrentlyProcessing(''), 3000);
                  break;
                  
                case 'error':
                  throw new Error(data.message || 'Analysis failed');
              }
              
            } catch (parseError) {
              console.error('Error parsing SSE data:', parseError, 'Line:', line);
            }
          }
        }
      }

    } catch (error) {
      console.error('Error in real-time analysis:', error);
      setError(`Error processing claims: ${error.message}`);
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