import React, { useState, useCallback, useEffect } from 'react';
import { Upload, Play, Download, AlertCircle, FileText, CheckCircle, Clock, Filter, Menu, X, Moon, Sun, Eye } from 'lucide-react';
import * as XLSX from 'xlsx';
import './App.css';

const PatentScreeningApp = () => {
  const [activeModule, setActiveModule] = useState('screening');
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  
  const [file, setFile] = useState(null);
  const [claims, setClaims] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');
  const [backendStatus, setBackendStatus] = useState('checking');
  const [startClaim, setStartClaim] = useState(1);
  const [endClaim, setEndClaim] = useState(100);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [processedCount, setProcessedCount] = useState(0);
  const [currentlyProcessing, setCurrentlyProcessing] = useState('');
  const [startTime, setStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [selectedRankFilter, setSelectedRankFilter] = useState(null);

  const [selectedFeatureFilter, setSelectedFeatureFilter] = useState(null);

  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [selectedAnalysis, setSelectedAnalysis] = useState(null);

  const resultsPerPage = 10;

  const calculateRank = (result) => {
    const features = [
      result.robotic_assisted,
      result.biomimicry,
      result.tremor_reduction,
      result.minimally_invasive
    ];
    
    const featureCount = features.filter(feature => feature === true).length;
    
    if (featureCount === 4) return 1;
    if (featureCount >= 3) return 2;
    if (featureCount >= 2) return 3;
    if (featureCount >= 1) return 4;
    return null;
  };

  const getRankColor = (rank) => {
    switch (rank) {
      case 1: return 'rank-1';
      case 2: return 'rank-2';
      case 3: return 'rank-3';
      case 4: return 'rank-4';
      default: return 'rank-none';
    }
  };

  const getRankLabel = (rank) => {
    switch (rank) {
      case 1: return 'Rank 1 - 4 Features';
      case 2: return 'Rank 2 - 3 Features';
      case 3: return 'Rank 3 - 2 Features';
      case 4: return 'Rank 4 - 1 Feature';
      default: return 'No Features';
    }
  };

  const processResultsWithRanking = (results) => {
    return results.map(result => ({
      ...result,
      rank: calculateRank(result),
      featureCount: [
        result.robotic_assisted,
        result.biomimicry,
        result.tremor_reduction,
        result.minimally_invasive
      ].filter(Boolean).length
    }));
  };

  const getFeatureStats = (results) => {
    return {
      robotic_assisted: results.filter(r => r.robotic_assisted).length,
      biomimicry: results.filter(r => r.biomimicry).length,
      tremor_reduction: results.filter(r => r.tremor_reduction).length,
      minimally_invasive: results.filter(r => r.minimally_invasive).length,
      total: results.length
    };
  };

  useEffect(() => {
    checkBackendStatus();
  }, []);

  useEffect(() => {
    if (claims.length > 0) {
      setEndClaim(Math.min(100, claims.length));
    }
  }, [claims]);

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
    if (darkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [darkMode]);

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

  const checkBackendStatus = async () => {
    try {
      const response = await fetch('http://localhost:3001/health');
      if (response.ok) {
        setBackendStatus('connected');
      } else {
        setBackendStatus('error');
      }
    } catch (error) {
      setBackendStatus('error');
    }
  };

  const handleFileUpload = useCallback((event) => {
    const uploadedFile = event.target.files[0];
    if (!uploadedFile) return;

    if (!uploadedFile.name.endsWith('.xlsx') && !uploadedFile.name.endsWith('.xls')) {
      setError('Please upload an Excel file (.xlsx or .xls)');
      return;
    }

    setFile(uploadedFile);
    setError('');
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);
        
        setClaims(jsonData);
        setResults([]);
        setProgress(0);
        setProcessedCount(0);
        setCurrentPage(1);
        setSearchTerm('');
        setElapsedTime(0);
        setSelectedRankFilter(null);
        setSelectedFeatureFilter(null);
      } catch (err) {
        setError('Error parsing Excel file: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(uploadedFile);
  }, []);

  const analyzeClaimWithGPT = async (claim, claimNumber) => {
    try {
      const response = await fetch('http://localhost:3001/analyze-claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          claim: claim,
          claimNumber: claimNumber
        })
      });

      if (!response.ok) {
        throw new Error(`Backend Error: ${response.status} ${response.statusText}`);
      }

      const analysis = await response.json();
      
      return {
        claimNumber: analysis.claimNumber,
        robotic_assisted: analysis.robotic_assisted || false,
        biomimicry: analysis.biomimicry || false,
        tremor_reduction: analysis.tremor_reduction || false,
        minimally_invasive: analysis.minimally_invasive || false,
        detailed_analysis: analysis.detailed_analysis || null
      };
    } catch (error) {
      console.error(`Error analyzing claim ${claimNumber}:`, error);
      
      return {
        claimNumber,
        robotic_assisted: false,
        biomimicry: false,
        tremor_reduction: false,
        minimally_invasive: false,
        detailed_analysis: null
      };
    }
  };

  const startBulkScreening = async () => {
    if (backendStatus !== 'connected') {
      setError('Backend server is not running. Please start the backend server first.');
      return;
    }

    if (claims.length === 0) {
      setError('Please upload an Excel file with patent claims');
      return;
    }

    if (startClaim < 1 || endClaim > claims.length || startClaim > endClaim) {
      setError(`Please enter valid claim range (1 to ${claims.length})`);
      return;
    }

    setIsProcessing(true);
    setError('');
    setResults([]);
    setProgress(0);
    setProcessedCount(0);
    setStartTime(Date.now());
    setElapsedTime(0);

    const claimsToProcess = claims.slice(startClaim - 1, endClaim);
    const batchSize = 1000;
    const totalClaims = claimsToProcess.length;
    const processedResults = [];

    for (let i = 0; i < totalClaims; i += batchSize) {
      const batch = claimsToProcess.slice(i, i + batchSize);
      
      const batchPromises = batch.map((claim, batchIndex) => {
        const claimText = claim.Claims || claim.claims || '';
        const claimNumber = claim['S.No.'] || (startClaim + i + batchIndex);
        const publicationNumber = claim['Publication Number'] || '';
        
        setCurrentlyProcessing(`Processing claim ${claimNumber} (${publicationNumber})`);
        
        return analyzeClaimWithGPT(claimText, claimNumber).then(result => ({
          ...result,
          publicationNumber
        }));
      });

      try {
        const batchResults = await Promise.all(batchPromises);
        processedResults.push(...batchResults);
        
        const currentProgress = Math.min(100, ((i + batchSize) / totalClaims) * 100);
        setProgress(currentProgress);
        setProcessedCount(processedResults.length);
        setResults([...processedResults]);

        if (i + batchSize < totalClaims) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        setError(`Error processing batch: ${error.message}`);
        break;
      }
    }

    setIsProcessing(false);
    setProgress(100);
    setCurrentlyProcessing('');
  };

  const rankedResults = processResultsWithRanking(results);
  
  const featureFilteredResults = selectedFeatureFilter 
    ? rankedResults.filter(result => result[selectedFeatureFilter] === true)
    : rankedResults;

  const searchFilteredResults = featureFilteredResults.filter(result => 
    result.claimNumber.toString().includes(searchTerm) ||
    (result.publicationNumber && result.publicationNumber.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredRankedResults = selectedRankFilter !== null 
    ? (selectedRankFilter === 'none' 
       ? searchFilteredResults.filter(result => result.rank === null)
       : searchFilteredResults.filter(result => result.rank === selectedRankFilter))
    : searchFilteredResults;

  const sortedResults = selectedRankFilter !== null 
    ? filteredRankedResults
    : filteredRankedResults.sort((a, b) => {
        if (a.rank === null && b.rank === null) return 0;
        if (a.rank === null) return 1;
        if (b.rank === null) return -1;
        return a.rank - b.rank;
      });

  const totalPages = Math.ceil(sortedResults.length / resultsPerPage);
  const paginatedResults = sortedResults.slice(
    (currentPage - 1) * resultsPerPage,
    currentPage * resultsPerPage
  );

  const showAnalysisDetails = (result) => {
    setSelectedAnalysis(result);
    setShowAnalysisModal(true);
  };

  const closeAnalysisModal = () => {
    setShowAnalysisModal(false);
    setSelectedAnalysis(null);
  };

  const renderFeatureFilters = () => {
    const stats = getFeatureStats(results);
    
    const features = [
      { 
        key: 'robotic_assisted', 
        label: 'Robotic-Assisted',
        count: stats.robotic_assisted
      },
      { 
        key: 'biomimicry', 
        label: 'Biomimicry Design',
        count: stats.biomimicry
      },
      { 
        key: 'tremor_reduction', 
        label: 'Tremor Reduction',
        count: stats.tremor_reduction
      },
      { 
        key: 'minimally_invasive', 
        label: 'Minimally Invasive',
        count: stats.minimally_invasive
      }
    ];

    const rankStats = {
      rank1: rankedResults.filter(r => r.rank === 1).length,
      rank2: rankedResults.filter(r => r.rank === 2).length,
      rank3: rankedResults.filter(r => r.rank === 3).length,
      rank4: rankedResults.filter(r => r.rank === 4).length,
      noRank: rankedResults.filter(r => r.rank === null).length
    };

    const ranks = [
      { key: 1, label: 'Rank 1 (4 Features)', count: rankStats.rank1 },
      { key: 2, label: 'Rank 2 (3 Features)', count: rankStats.rank2 },
      { key: 3, label: 'Rank 3 (2 Features)', count: rankStats.rank3 },
      { key: 4, label: 'Rank 4 (1 Feature)', count: rankStats.rank4 },
      { key: 'none', label: 'No Rank (0 Features)', count: rankStats.noRank }
    ];

    const handleFeatureFilter = (featureKey) => {
      if (selectedFeatureFilter === featureKey) {
        setSelectedFeatureFilter(null);
      } else {
        setSelectedFeatureFilter(featureKey);
        setSelectedRankFilter(null);
      }
      setCurrentPage(1);
    };

    const handleRankFilter = (rankKey) => {
      if (selectedRankFilter === rankKey) {
        setSelectedRankFilter(null);
      } else {
        setSelectedRankFilter(rankKey);
        setSelectedFeatureFilter(null);
      }
      setCurrentPage(1);
    };

    const clearAllFilters = () => {
      setSelectedFeatureFilter(null);
      setSelectedRankFilter(null);
      setSearchTerm('');
      setCurrentPage(1);
    };

    return (
      <div className="dropdown-filters">
        <div className="filters-header">
          <div className="filters-title-section">
            <h3 className="filters-title">Filters & Export</h3>
            <div className="results-summary">
              <span className="summary-text">
                Showing {filteredRankedResults.length} of {stats.total} patents
                {selectedFeatureFilter && ` • ${features.find(f => f.key === selectedFeatureFilter)?.label}`}
                {selectedRankFilter !== null && ` • ${ranks.find(r => r.key === selectedRankFilter)?.label}`}
                {searchTerm && ` • Search: "${searchTerm}"`}
              </span>
            </div>
          </div>
          
          {(selectedFeatureFilter || selectedRankFilter || searchTerm) && (
            <button 
              onClick={clearAllFilters}
              className="clear-all-btn"
            >
              Clear All Filters
            </button>
          )}
        </div>

        <div className="dropdown-filters-row">
          <div className="filter-dropdown">
            <select 
              value={selectedFeatureFilter || ''}
              onChange={(e) => handleFeatureFilter(e.target.value || null)}
              className={`filter-select ${selectedFeatureFilter ? 'selected' : ''}`}
            >
              <option value="">Filter by Feature</option>
              {features.map((feature) => (
                <option 
                  key={feature.key} 
                  value={feature.key}
                  disabled={feature.count === 0}
                >
                  {feature.label} ({feature.count})
                </option>
              ))}
            </select>
          </div>

          <div className="filter-dropdown">
            <select 
              value={selectedRankFilter === null ? '' : selectedRankFilter}
              onChange={(e) => handleRankFilter(e.target.value === '' ? null : e.target.value === 'none' ? 'none' : parseInt(e.target.value))}
              className={`filter-select ${selectedRankFilter !== null ? 'selected' : ''}`}
            >
              <option value="">Filter by Rank</option>
              {ranks.map((rank) => (
                <option 
                  key={rank.key} 
                  value={rank.key}
                  disabled={rank.count === 0}
                >
                  {rank.label} ({rank.count})
                </option>
              ))}
            </select>
          </div>

          <button onClick={exportResults} className="export-button">
            <Download size={16} className="export-button-icon" />
            Export Results
          </button>
        </div>
      </div>
    );
  };

  const exportResults = () => {
    if (results.length === 0) return;

    const resultsToExport = sortedResults;
    
    if (resultsToExport.length === 0) {
      alert('No results to export. Please adjust your filters.');
      return;
    }

    const exportData = resultsToExport.map((result) => {
      const originalClaimIndex = result.claimNumber - startClaim;
      const originalClaim = claims[startClaim - 1 + originalClaimIndex] || {};
      
      const publicationCell = result.publicationNumber || '';
      
      const basicData = {
        'S.No.': result.claimNumber,
        'Publication Number': publicationCell,
        'Claims': originalClaim.Claims || ''
      };

      if (!selectedFeatureFilter) {
        basicData['Rank'] = result.rank || 'No Rank';
        basicData['Feature Count'] = `${result.featureCount}/4`;
        basicData['Robotic-Assisted'] = result.robotic_assisted ? 'Yes' : 'No';
        basicData['Biomimicry Design'] = result.biomimicry ? 'Yes' : 'No';
        basicData['Tremor Reduction'] = result.tremor_reduction ? 'Yes' : 'No';
        basicData['Minimally Invasive'] = result.minimally_invasive ? 'Yes' : 'No';
      } else {
        if (selectedFeatureFilter === 'robotic_assisted') {
          basicData['Robotic-Assisted'] = result.robotic_assisted ? 'Yes' : 'No';
        } else if (selectedFeatureFilter === 'biomimicry') {
          basicData['Biomimicry Design'] = result.biomimicry ? 'Yes' : 'No';
        } else if (selectedFeatureFilter === 'tremor_reduction') {
          basicData['Tremor Reduction'] = result.tremor_reduction ? 'Yes' : 'No';
        } else if (selectedFeatureFilter === 'minimally_invasive') {
          basicData['Minimally Invasive'] = result.minimally_invasive ? 'Yes' : 'No';
        }
      }

      if (result.detailed_analysis) {
        const analysis = result.detailed_analysis;
        
        if (!selectedFeatureFilter) {
          basicData['Robotic-Assisted Confidence'] = analysis.robotic_assisted?.confidence || 'N/A';
          basicData['Robotic-Assisted Reasoning'] = analysis.robotic_assisted?.reasoning || 'N/A';
          basicData['Biomimicry Confidence'] = analysis.biomimicry?.confidence || 'N/A';
          basicData['Biomimicry Reasoning'] = analysis.biomimicry?.reasoning || 'N/A';
          basicData['Tremor Reduction Confidence'] = analysis.tremor_reduction?.confidence || 'N/A';
          basicData['Tremor Reduction Reasoning'] = analysis.tremor_reduction?.reasoning || 'N/A';
          basicData['Minimally Invasive Confidence'] = analysis.minimally_invasive?.confidence || 'N/A';
          basicData['Minimally Invasive Reasoning'] = analysis.minimally_invasive?.reasoning || 'N/A';
        } else {
          if (selectedFeatureFilter === 'robotic_assisted') {
            basicData['Confidence Level'] = analysis.robotic_assisted?.confidence || 'N/A';
            basicData['Analysis Reasoning'] = analysis.robotic_assisted?.reasoning || 'N/A';
            basicData['Claims Found'] = analysis.robotic_assisted?.claims_found?.join(', ') || 'None';
            basicData['Specification Assessment'] = analysis.robotic_assisted?.specification_assessment || 'N/A';
          } else if (selectedFeatureFilter === 'biomimicry') {
            basicData['Confidence Level'] = analysis.biomimicry?.confidence || 'N/A';
            basicData['Analysis Reasoning'] = analysis.biomimicry?.reasoning || 'N/A';
            basicData['Claims Found'] = analysis.biomimicry?.claims_found?.join(', ') || 'None';
            basicData['Specification Assessment'] = analysis.biomimicry?.specification_assessment || 'N/A';
          } else if (selectedFeatureFilter === 'tremor_reduction') {
            basicData['Confidence Level'] = analysis.tremor_reduction?.confidence || 'N/A';
            basicData['Analysis Reasoning'] = analysis.tremor_reduction?.reasoning || 'N/A';
            basicData['Claims Found'] = analysis.tremor_reduction?.claims_found?.join(', ') || 'None';
            basicData['Specification Assessment'] = analysis.tremor_reduction?.specification_assessment || 'N/A';
          } else if (selectedFeatureFilter === 'minimally_invasive') {
            basicData['Confidence Level'] = analysis.minimally_invasive?.confidence || 'N/A';
            basicData['Analysis Reasoning'] = analysis.minimally_invasive?.reasoning || 'N/A';
            basicData['Claims Found'] = analysis.minimally_invasive?.claims_found?.join(', ') || 'None';
            basicData['Specification Assessment'] = analysis.minimally_invasive?.specification_assessment || 'N/A';
          }
        }
      }

      return basicData;
    });

    let filename = `patent_screening_results_${startClaim}-${endClaim}`;
    
    if (selectedFeatureFilter) {
      const featureNames = {
        robotic_assisted: 'robotic_assisted',
        biomimicry: 'biomimicry',
        tremor_reduction: 'tremor_reduction',
        minimally_invasive: 'minimally_invasive'
      };
      filename += `_${featureNames[selectedFeatureFilter]}_filtered`;
    }
    
    if (selectedRankFilter !== null) {
      filename += `_rank_${selectedRankFilter === 'none' ? 'none' : selectedRankFilter}`;
    }
    
    if (searchTerm) {
      filename += `_search_${searchTerm.replace(/[^a-zA-Z0-9]/g, '_')}`;
    }

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Filtered Results');
    XLSX.writeFile(wb, `${filename}.xlsx`);
  };

  const navigationItems = [
    { id: 'screening', label: 'Screening', icon: Filter }
  ];

  return (
    <div className="dashboard-container">
      <button
        onClick={() => setDarkMode(!darkMode)}
        className="dark-mode-toggle"
        title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      >
        {darkMode ? <Sun size={20} /> : <Moon size={20} />}
      </button>

      <button
        onClick={() => setSidebarVisible(!sidebarVisible)}
        className={`sidebar-toggle-btn ${sidebarVisible ? 'sidebar-toggle-shifted' : ''}`}
        title={sidebarVisible ? 'Hide Sidebar' : 'Show Sidebar'}
      >
        {sidebarVisible ? <X size={20} /> : <Menu size={20} />}
      </button>

      <div className={`sidebar ${sidebarVisible ? 'sidebar-visible' : 'sidebar-hidden'}`}>
        <div className="sidebar-header">
          <h1 className="sidebar-title">FTO Patents</h1>
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
          <div className="status-indicator">
            <div className={`status-dot ${backendStatus === 'connected' ? '' : backendStatus === 'checking' ? 'status-dot-yellow' : 'status-dot-red'}`}></div>
            <span className="status-text">
              {backendStatus === 'connected' ? 'System Online' : 
               backendStatus === 'checking' ? 'Connecting...' : 'System Offline'}
            </span>
          </div>
        </div>
      </div>

      <div className={`main-content ${sidebarVisible ? 'main-content-with-sidebar' : 'main-content-full-width'}`}>
        <div className="module-content">
          <div className="section">
            <div className="compact-config-section">
              <div className="config-row">
                <div className="upload-section">
                  <label htmlFor="file-upload" className="compact-upload-button">
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="file-upload"
                    />
                    <Upload size={18} className="upload-button-icon" />
                    Upload Excel File
                  </label>
                  
                  {file && (
                    <div className="file-success-compact">
                      <CheckCircle size={14} color="#059669" />
                      <span>{file.name} - {claims.length} claims detected</span>
                    </div>
                  )}
                </div>

                {claims.length > 0 && (
                  <div className="range-section">
                    <div className="range-inputs">
                      <div className="range-input-group">
                        <label className="range-label">Start</label>
                        <input
                          type="number"
                          min="1"
                          max={claims.length}
                          value={startClaim}
                          onChange={(e) => setStartClaim(parseInt(e.target.value) || 1)}
                          className="range-input"
                          disabled={isProcessing}
                        />
                      </div>
                      <div className="range-input-group">
                        <label className="range-label">End</label>
                        <input
                          type="number"
                          min="1"
                          max={claims.length}
                          value={endClaim}
                          onChange={(e) => setEndClaim(parseInt(e.target.value) || claims.length)}
                          className="range-input"
                          disabled={isProcessing}
                        />
                      </div>
                    </div>
                    
                    <div className="claims-info">
                      <span className="claims-selected-compact">
                        {Math.max(0, endClaim - startClaim + 1)} claims selected
                      </span>
                      <button
                        onClick={startBulkScreening}
                        disabled={isProcessing || backendStatus !== 'connected'}
                        className="start-button-compact"
                      >
                        <Play size={16} className="button-icon" />
                        {isProcessing ? 'Processing...' : 'Start Analysis'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {isProcessing && (
                <div className="progress-section-compact">
                  <div className="progress-info-row">
                    <div className="progress-stats">
                      <div className="progress-number-compact">{Math.round(progress)}%</div>
                      <div className="progress-details">
                        <div className="progress-label-compact">
                          {processedCount} of {endClaim - startClaim + 1} claims analyzed
                        </div>
                        <div className="progress-time-compact">{formatElapsedTime(elapsedTime)}</div>
                      </div>
                    </div>
                    
                    {currentlyProcessing && (
                      <div className="progress-status-compact">
                        <Clock size={14} className="progress-status-icon" />
                        <span className="progress-current">{currentlyProcessing}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="progress-bar-compact">
                    <div
                      className="progress-fill"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="error-box">
              <div className="error-content">
                <AlertCircle size={24} color="#dc2626" />
                <p className="error-text">{error}</p>
              </div>
            </div>
          )}

          {results.length > 0 && (
            <div className="section">
              <div className="results-header">
                <h2 className="results-title">
                  Analysis Results
                  <span className="results-badge">
                    {results.length} processed
                  </span>
                </h2>
              </div>

              {renderFeatureFilters()}

              <div className="search-container">
                <input
                  type="text"
                  placeholder="Search claims or publication numbers..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="search-input"
                />
              </div>

              <div className="table-container">
                <table className="results-table">
                  <thead className="table-header">
                    <tr>
                      {!selectedFeatureFilter && (
                        <th className="table-header-cell">Rank</th>
                      )}
                      <th className="table-header-cell">Claim #</th>
                      <th className="table-header-cell">Publication</th>
                      
                      {!selectedFeatureFilter && (
                        <>
                          <th className="table-header-cell">Robotic-Assisted</th>
                          <th className="table-header-cell">Biomimicry</th>
                          <th className="table-header-cell">Tremor Reduction</th>
                          <th className="table-header-cell">Minimally Invasive</th>
                        </>
                      )}
                      
                      {selectedFeatureFilter === 'robotic_assisted' && (
                        <th className="table-header-cell feature-highlight">Robotic-Assisted</th>
                      )}
                      {selectedFeatureFilter === 'biomimicry' && (
                        <th className="table-header-cell feature-highlight">Biomimicry Design</th>
                      )}
                      {selectedFeatureFilter === 'tremor_reduction' && (
                        <th className="table-header-cell feature-highlight">Tremor Reduction</th>
                      )}
                      {selectedFeatureFilter === 'minimally_invasive' && (
                        <th className="table-header-cell feature-highlight">Minimally Invasive</th>
                      )}
                      
                      <th className="table-header-cell">Analysis Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedResults.map((result, index) => (
                      <tr key={index} className="table-row">
                        {!selectedFeatureFilter && (
                          <td className="table-cell table-cell-center">
                            {result.rank ? (
                              <span className={`rank-badge ${getRankColor(result.rank)}`}>
                                {result.rank}
                              </span>
                            ) : (
                              <span className="rank-badge rank-none">-</span>
                            )}
                          </td>
                        )}
                        <td className="table-cell table-cell-center">
                          <span className="table-cell-claim">{result.claimNumber}</span>
                        </td>
                        <td className="table-cell table-cell-center">
                          {result.publicationNumber && result.publicationNumber !== 'N/A' ? (
                            <a href={`https://patents.google.com/patent/${result.publicationNumber}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="publication-link"
                              title={`View ${result.publicationNumber} on Google Patents`}
                            >
                              {result.publicationNumber}
                            </a>
                          ) : (
                            <span className="table-cell-publication">N/A</span>
                          )}
                        </td>
                        
                        {!selectedFeatureFilter && (
                          <>
                            <td className="table-cell table-cell-center">
                              <span className={`badge ${result.robotic_assisted ? 'badge-yes' : 'badge-no'}`}>
                                {result.robotic_assisted ? 'Yes' : 'No'}
                              </span>
                            </td>
                            <td className="table-cell table-cell-center">
                              <span className={`badge ${result.biomimicry ? 'badge-yes' : 'badge-no'}`}>
                                {result.biomimicry ? 'Yes' : 'No'}
                              </span>
                            </td>
                            <td className="table-cell table-cell-center">
                              <span className={`badge ${result.tremor_reduction ? 'badge-yes' : 'badge-no'}`}>
                                {result.tremor_reduction ? 'Yes' : 'No'}
                              </span>
                            </td>
                            <td className="table-cell table-cell-center">
                              <span className={`badge ${result.minimally_invasive ? 'badge-yes' : 'badge-no'}`}>
                                {result.minimally_invasive ? 'Yes' : 'No'}
                              </span>
                            </td>
                          </>
                        )}
                        
                        {selectedFeatureFilter === 'robotic_assisted' && (
                          <td className="table-cell table-cell-center feature-highlight-cell">
                            <span className={`badge ${result.robotic_assisted ? 'badge-yes' : 'badge-no'}`}>
                              {result.robotic_assisted ? 'Yes' : 'No'}
                            </span>
                          </td>
                        )}
                        {selectedFeatureFilter === 'biomimicry' && (
                          <td className="table-cell table-cell-center feature-highlight-cell">
                            <span className={`badge ${result.biomimicry ? 'badge-yes' : 'badge-no'}`}>
                              {result.biomimicry ? 'Yes' : 'No'}
                            </span>
                          </td>
                        )}
                        {selectedFeatureFilter === 'tremor_reduction' && (
                          <td className="table-cell table-cell-center feature-highlight-cell">
                            <span className={`badge ${result.tremor_reduction ? 'badge-yes' : 'badge-no'}`}>
                              {result.tremor_reduction ? 'Yes' : 'No'}
                            </span>
                          </td>
                        )}
                        {selectedFeatureFilter === 'minimally_invasive' && (
                          <td className="table-cell table-cell-center feature-highlight-cell">
                            <span className={`badge ${result.minimally_invasive ? 'badge-yes' : 'badge-no'}`}>
                              {result.minimally_invasive ? 'Yes' : 'No'}
                            </span>
                          </td>
                        )}
                        
                        <td className="table-cell table-cell-center">
                          <button 
                            className="details-btn"
                            onClick={() => showAnalysisDetails(result)}
                            disabled={!result.detailed_analysis}
                            title="View detailed analysis"
                          >
                            <Eye size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="pagination">
                  <p className="pagination-info">
                    Showing <span className="pagination-info-bold">{((currentPage - 1) * resultsPerPage) + 1}</span> to <span className="pagination-info-bold">{Math.min(currentPage * resultsPerPage, sortedResults.length)}</span> of <span className="pagination-info-bold">{sortedResults.length}</span> results
                  </p>
                  <div className="pagination-controls">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="pagination-button"
                    >
                      Previous
                    </button>
                    
                    <div className="pagination-numbers">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            className={`pagination-button ${currentPage === pageNum ? 'active' : ''}`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>
                    
                    <button
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="pagination-button"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showAnalysisModal && selectedAnalysis && selectedAnalysis.detailed_analysis && (
        <div className="modal-overlay" onClick={closeAnalysisModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                Detailed Analysis - Claim {selectedAnalysis.claimNumber}
              </h2>
              <button className="close-btn" onClick={closeAnalysisModal}>
                ×
              </button>
            </div>
            <div className="modal-content">
              <div className="claim-info">
                <div className="claim-meta">
                  <div className="meta-item">
                    <span className="meta-label">Patent:</span>
                    <span className="meta-value">{selectedAnalysis.publicationNumber || 'N/A'}</span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-label">Rank:</span>
                    <span className="meta-value">
                      {selectedAnalysis.rank ? `${selectedAnalysis.rank} (${selectedAnalysis.featureCount}/4 features)` : 'No Rank (0/4 features)'}
                    </span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-label">Analysis Date:</span>
                    <span className="meta-value">{new Date().toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              <div className="analysis-grid">
                {Object.entries({
                  robotic_assisted: 'Robotic-Assisted',
                  biomimicry: 'Biomimicry Design', 
                  tremor_reduction: 'Tremor Reduction',
                  minimally_invasive: 'Minimally Invasive'
                }).filter(([key]) => {
                  if (selectedFeatureFilter) {
                    return key === selectedFeatureFilter;
                  }
                  return true;
                }).map(([key, displayName]) => {
                  const feature = selectedAnalysis.detailed_analysis[key];
                  if (!feature) return null;

                  const confidenceClass = feature.confidence?.toLowerCase() === 'high' ? 'confidence-high' : 
                                        feature.confidence?.toLowerCase() === 'medium' ? 'confidence-medium' : 'confidence-low';

                  return (
                    <div key={key} className={`feature-analysis ${feature.present ? 'present' : 'absent'}`}>
                      <div className="feature-header">
                        <div className="feature-name">
                          <span>{feature.present ? '✓' : '✗'}</span>
                          {displayName}
                        </div>
                        <div className={`confidence-score ${confidenceClass}`}>
                          {feature.confidence || 'Unknown'} Confidence
                        </div>
                      </div>
                      <div className="feature-details">
                        <h4>Analysis Reasoning:</h4>
                        <p>{feature.reasoning || 'No reasoning provided'}</p>
                        
                        {feature.claims_found && feature.claims_found.length > 0 ? (
                          <>
                            <h4>Claims Found:</h4>
                            <div className="claims-found">
                              {feature.claims_found.map((claim, idx) => (
                                <span key={idx} className="claim-tag">Claim {claim}</span>
                              ))}
                            </div>
                          </>
                        ) : (
                          <h4>No relevant claims identified</h4>
                        )}
                        
                        <h4>Specification Assessment:</h4>
                        <p>{feature.specification_assessment || 'No assessment provided'}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatentScreeningApp;