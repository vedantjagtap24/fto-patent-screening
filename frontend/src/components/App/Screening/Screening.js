import React, { useState, useCallback } from 'react';
import { Upload, Play, Download, AlertCircle, CheckCircle, Clock, Eye, Plus, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import './Screening.css';

const Screening = ({ 
  backendStatus, file, setFile, claims, setClaims, isProcessing, progress, results, error, setError,
  processedCount, currentlyProcessing, elapsedTime, features, addFeature, removeFeature,
  startBulkScreening, clearAllData, formatElapsedTime
}) => {
  // UI state
  const [uiState, setUiState] = useState({
    searchTerm: '',
    currentPage: 1,
    selectedRankFilter: null,
    selectedFeatureFilter: null,
    showAnalysisModal: false,
    selectedAnalysis: null,
    newFeature: '',
    showFeatureDropdown: false,
    showRankDropdown: false
  });

  const resultsPerPage = 10;

  // Update UI state helper
  const updateUiState = (updates) => {
    setUiState(prev => ({ ...prev, ...updates }));
  };

  // Ranking and filtering logic
  const calculateRank = (result) => {
    const featureCount = features.filter((_, index) => 
      result[`feature_${index + 1}`] === true
    ).length;
    
    if (featureCount === features.length) return 1;
    if (featureCount >= Math.ceil(features.length * 0.75)) return 2;
    if (featureCount >= Math.ceil(features.length * 0.5)) return 3;
    if (featureCount >= 1) return 4;
    return null;
  };

  const getRankColor = (rank) => {
    const colors = { 1: 'rank-1', 2: 'rank-2', 3: 'rank-3', 4: 'rank-4' };
    return colors[rank] || 'rank-none';
  };

  const processResultsWithRanking = (results) => {
    return results.map(result => ({
      ...result,
      rank: calculateRank(result),
      featureCount: features.filter((_, index) => 
        result[`feature_${index + 1}`] === true
      ).length
    }));
  };

  const getFilteredResults = (rankedResults) => {
    // Apply rank filter
    let filtered = rankedResults;
    if (uiState.selectedRankFilter !== null) {
      if (uiState.selectedRankFilter === 'none') {
        filtered = filtered.filter(result => result.rank === null);
      } else {
        filtered = filtered.filter(result => result.rank === uiState.selectedRankFilter);
      }
    } else {
      // Default: show only Rank 1 and Rank 2
      filtered = filtered.filter(result => result.rank === 1 || result.rank === 2);
    }

    // Apply feature filter
    if (uiState.selectedFeatureFilter) {
      filtered = filtered.filter(result => result[uiState.selectedFeatureFilter] === true);
    }

    // Apply search filter
    filtered = filtered.filter(result => 
      result.claimNumber.toString().includes(uiState.searchTerm) ||
      (result.publicationNumber && result.publicationNumber.toLowerCase().includes(uiState.searchTerm.toLowerCase()))
    );

    return filtered.sort((a, b) => {
      if (a.rank === null && b.rank === null) return 0;
      if (a.rank === null) return 1;
      if (b.rank === null) return -1;
      return a.rank - b.rank;
    });
  };

  // Publication number detection
  const findPublicationColumn = (jsonData) => {
    if (!jsonData || jsonData.length === 0) return null;
    
    const firstRow = jsonData[0];
    const possibleColumns = [
      'Publication Number', 'Publication', 'Pub Number', 'Patent Number',
      'Patent Publication', 'Publication No', 'Pub No', 'Patent No'
    ];
    
    // Try exact matches first
    for (const col of possibleColumns) {
      if (firstRow.hasOwnProperty(col)) return col;
    }
    
    // Try case-insensitive partial matches
    const columns = Object.keys(firstRow);
    for (const column of columns) {
      const lowerColumn = column.toLowerCase();
      if (lowerColumn.includes('publication') || 
          lowerColumn.includes('patent') || 
          lowerColumn.includes('pub')) {
        return column;
      }
    }
    
    return null;
  };

  // File upload handler
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
        
        // Detect publication column automatically
        const publicationColumn = findPublicationColumn(jsonData);
        
        // Add publication number to each claim if detected
        if (publicationColumn) {
          jsonData.forEach(claim => {
            if (!claim['Publication Number'] && claim[publicationColumn]) {
              claim['Publication Number'] = claim[publicationColumn];
            }
          });
        }
        
        setClaims(jsonData);
        updateUiState({
          currentPage: 1,
          searchTerm: '',
          selectedRankFilter: null,
          selectedFeatureFilter: null
        });
      } catch (err) {
        setError('Error parsing Excel file: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(uploadedFile);
  }, [setFile, setClaims, setError]);

  // Feature management
  const handleAddFeature = () => {
    if (addFeature(uiState.newFeature)) {
      updateUiState({ newFeature: '' });
    }
  };

  // Filter handlers (consolidated)
  const handleFilter = (type, key) => {
    const updates = { currentPage: 1 };
    
    if (type === 'feature') {
      updates.selectedFeatureFilter = uiState.selectedFeatureFilter === key ? null : key;
      updates.selectedRankFilter = null;
      updates.showFeatureDropdown = false;
    } else if (type === 'rank') {
      updates.selectedRankFilter = uiState.selectedRankFilter === key ? null : key;
      updates.selectedFeatureFilter = null;
      updates.showRankDropdown = false;
    }
    
    updateUiState(updates);
  };

  const clearAllFilters = () => {
    updateUiState({
      selectedFeatureFilter: null,
      selectedRankFilter: null,
      searchTerm: '',
      currentPage: 1,
      showFeatureDropdown: false,
      showRankDropdown: false
    });
  };

  // Modal handlers
  const showAnalysisDetails = (result) => {
    updateUiState({
      selectedAnalysis: result,
      showAnalysisModal: true
    });
    document.body.style.overflow = 'hidden';
  };

  const closeAnalysisModal = () => {
    updateUiState({
      showAnalysisModal: false,
      selectedAnalysis: null
    });
    document.body.style.overflow = 'unset';
  };

  // Export functionality
  const exportResults = () => {
    if (results.length === 0) return;

    const rankedResults = processResultsWithRanking(results);
    const filteredResults = getFilteredResults(rankedResults);
    
    if (filteredResults.length === 0) {
      alert('No results to export. Please adjust your filters.');
      return;
    }

    const exportData = filteredResults.map((result) => {
      const originalClaim = claims.find(c => (c['S.No.'] || claims.indexOf(c) + 1) === result.claimNumber) || {};
      
      const data = {
        'S.No.': result.claimNumber,
        'Publication Number': result.publicationNumber || '',
        'Claims': originalClaim.Claims || '',
        'Rank': result.rank || 'No Rank',
        'Feature Count': `${result.featureCount}/${features.length}`
      };

      // Add feature columns
      features.forEach((feature, index) => {
        data[feature] = result[`feature_${index + 1}`] ? 'Yes' : 'No';
      });

      // Add detailed analysis if not filtering by feature
      if (!uiState.selectedFeatureFilter && result.detailed_analysis) {
        features.forEach((feature, index) => {
          const key = `feature_${index + 1}`;
          const analysis = result.detailed_analysis[key];
          if (analysis) {
            data[`${feature} - Confidence`] = analysis.confidence || 'N/A';
            data[`${feature} - Reasoning`] = analysis.reasoning || 'N/A';
            data[`${feature} - Relevant Claims`] = analysis.relevant_claims || 'N/A';
          }
        });
      }

      return data;
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Patent Analysis Results');
    XLSX.writeFile(wb, 'patent_analysis_results.xlsx');
  };

  // Get statistics
  const getStats = () => {
    const rankedResults = processResultsWithRanking(results);
    const stats = { total: results.length };
    
    features.forEach((feature, index) => {
      stats[`feature_${index + 1}`] = results.filter(r => r[`feature_${index + 1}`]).length;
    });

    const rankStats = {
      rank1: rankedResults.filter(r => r.rank === 1).length,
      rank2: rankedResults.filter(r => r.rank === 2).length,
      rank3: rankedResults.filter(r => r.rank === 3).length,
      rank4: rankedResults.filter(r => r.rank === 4).length,
      noRank: rankedResults.filter(r => r.rank === null).length
    };

    return { stats, rankStats, rankedResults };
  };

  // Render filter dropdown
  const renderFilterDropdown = (type, options, selected, show, setShow) => {
    return (
      <div className="filter-dropdown modern-dropdown">
        <button 
          className={`modern-filter-btn ${selected ? 'selected' : ''}`}
          onClick={() => setShow(!show)}
        >
          <span>
            {type === 'feature' 
              ? (selected ? features[parseInt(selected.split('_')[1]) - 1] : 'Filter by Feature')
              : (selected !== null ? options.find(r => r.key === selected)?.label || 'Filter by Rank' : 'Filter by Rank')
            }
          </span>
          <svg 
            className={`dropdown-arrow ${show ? 'rotated' : ''}`}
            width="16" height="16" viewBox="0 0 24 24" fill="none" 
            stroke="currentColor" strokeWidth="2"
          >
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </button>
        
        {show && (
          <div className="modern-dropdown-menu">
            <div 
              className="modern-dropdown-option"
              onClick={() => handleFilter(type, null)}
            >
              <span>All {type === 'feature' ? 'Features' : 'Ranks'}</span>
            </div>
            {options.map((option) => (
              <div
                key={option.key}
                className={`modern-dropdown-option ${option.count === 0 ? 'disabled' : ''} ${selected === option.key ? 'selected' : ''}`}
                onClick={() => option.count > 0 && handleFilter(type, option.key)}
              >
                <span>{option.label}</span>
                <span className="option-count">({option.count})</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Main component logic
  const { stats, rankStats, rankedResults } = getStats();
  const filteredResults = getFilteredResults(rankedResults);
  const totalPages = Math.ceil(filteredResults.length / resultsPerPage);
  const paginatedResults = filteredResults.slice(
    (uiState.currentPage - 1) * resultsPerPage,
    uiState.currentPage * resultsPerPage
  );

  // Prepare options for dropdowns
  const featureOptions = features.map((feature, index) => {
    const key = `feature_${index + 1}`;
    return { key, label: feature, count: stats[key] || 0 };
  });

  const rankOptions = [
    { key: 1, label: `Rank 1 (${features.length} Features)`, count: rankStats.rank1 },
    { key: 2, label: `Rank 2 (${Math.ceil(features.length * 0.75)}+ Features)`, count: rankStats.rank2 },
    { key: 3, label: `Rank 3 (${Math.ceil(features.length * 0.5)}+ Features)`, count: rankStats.rank3 },
    { key: 4, label: 'Rank 4 (1+ Feature)', count: rankStats.rank4 },
    { key: 'none', label: 'No Rank (0 Features)', count: rankStats.noRank }
  ];

  return (
    <div className="module-content">
      <div className="section">
        <div className="centered-upload-section">
          <div className="upload-and-analysis-container">
            <div className="upload-section-centered">
              <label htmlFor="file-upload" className="centered-upload-button">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload"
                />
                <Upload size={20} className="upload-button-icon" />
                Upload Excel File
              </label>
              
              {file && (
                <div className="file-success-centered">
                  <CheckCircle size={16} color="#059669" />
                  <span>{file.name} - {claims.length} patents detected</span>
                </div>
              )}
            </div>
          </div>

          {/* Feature Configuration */}
          {claims.length > 0 && (
            <div style={{ 
              marginTop: '2rem', padding: '1.5rem', background: 'white',
              borderRadius: '1rem', border: '1px solid #e5e7eb'
            }}>
              <h3 style={{ 
                marginBottom: '1rem', fontWeight: '600', color: '#111827'
              }}>
                What features do you want to find?
              </h3>

              {features.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <h4 style={{ marginBottom: '0.5rem', color: '#374151' }}>
                    Features to analyze ({features.length}):
                  </h4>
                  <div style={{ 
                    display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' 
                  }}>
                    {features.map((feature, index) => (
                      <div key={index} className="feature-badge" style={{ 
                        display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem'
                      }}>
                        <span>{feature}</span>
                        <button
                          onClick={() => removeFeature(index)}
                          style={{ 
                            background: 'none', border: 'none', color: 'inherit',
                            cursor: 'pointer', padding: '0', display: 'flex'
                          }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  value={uiState.newFeature}
                  onChange={(e) => updateUiState({ newFeature: e.target.value })}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddFeature()}
                  placeholder="Type a feature (e.g., 'wireless connectivity', 'machine learning')"
                  style={{ 
                    flex: 1, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem'
                  }}
                />
                <button
                  onClick={handleAddFeature}
                  className="start-button-centered"
                  style={{ minWidth: 'auto', padding: '0.5rem 1rem' }}
                >
                  <Plus size={16} className="button-icon" />
                  Add
                </button>
              </div>
            </div>
          )}

          {/* Start Analysis Button */}
          {claims.length > 0 && features.length > 0 && (
            <button
              onClick={startBulkScreening}
              disabled={isProcessing || backendStatus !== 'connected'}
              className={`start-button-centered ${isProcessing || backendStatus !== 'connected' ? 'disabled' : ''}`}
              style={{ marginTop: '1.5rem' }}
            >
              <Play size={18} className="button-icon" />
              {isProcessing ? 'Processing...' : 'Start Analysis'}
            </button>
          )}

          {/* Progress Section */}
          {isProcessing && (
            <div className="progress-section-centered">
              <div className="progress-info-row">
                <div className="progress-stats">
                  <div className="progress-number-compact">{Math.round(progress)}%</div>
                  <div className="progress-details">
                    <div className="progress-label-compact">
                      {processedCount} of {claims.length} patents analyzed
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
                <div className="progress-fill" style={{ width: `${progress}%` }} />
              </div>
              
              {processedCount > 0 && processedCount < claims.length && (
                <div style={{ 
                  fontSize: '0.75rem', color: '#6b7280', textAlign: 'center', marginTop: '0.5rem' 
                }}>
                  Estimated time remaining: {(() => {
                    const avgTimePerClaim = elapsedTime / processedCount;
                    const remainingClaims = claims.length - processedCount;
                    const remainingTime = avgTimePerClaim * remainingClaims;
                    return formatElapsedTime(remainingTime);
                  })()}
                </div>
              )}
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
              <span className="results-badge">{results.length} processed</span>
            </h2>
          </div>

          {/* Filters */}
          <div className="dropdown-filters">
            <div className="filters-header">
              <div className="filters-title-section">
                <h3 className="filters-title">Filters & Export</h3>
                <div className="results-summary">
                  <span className="summary-text">
                    Showing {filteredResults.length} of {stats.total} patents
                    {uiState.selectedFeatureFilter && ` • ${features[parseInt(uiState.selectedFeatureFilter.split('_')[1]) - 1]}`}
                    {uiState.selectedRankFilter !== null && ` • ${rankOptions.find(r => r.key === uiState.selectedRankFilter)?.label}`}
                    {uiState.selectedRankFilter === null && uiState.selectedFeatureFilter === null && ` • High Priority (Rank 1 & 2)`}
                    {uiState.searchTerm && ` • Search: "${uiState.searchTerm}"`}
                  </span>
                </div>
              </div>
              
              {(uiState.selectedFeatureFilter || uiState.selectedRankFilter || uiState.searchTerm) && (
                <button onClick={clearAllFilters} className="clear-all-btn">
                  Clear All Filters
                </button>
              )}
            </div>

            <div className="dropdown-filters-row">
              {renderFilterDropdown(
                'feature', 
                featureOptions, 
                uiState.selectedFeatureFilter, 
                uiState.showFeatureDropdown,
                (show) => updateUiState({ showFeatureDropdown: show, showRankDropdown: false })
              )}

              {renderFilterDropdown(
                'rank', 
                rankOptions, 
                uiState.selectedRankFilter, 
                uiState.showRankDropdown,
                (show) => updateUiState({ showRankDropdown: show, showFeatureDropdown: false })
              )}

              <button onClick={exportResults} className="export-button">
                <Download size={16} className="export-button-icon" />
                Export Results
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="search-container">
            <input
              type="text"
              placeholder="Search patent or publication number..."
              value={uiState.searchTerm}
              onChange={(e) => updateUiState({ 
                searchTerm: e.target.value, 
                currentPage: 1 
              })}
              className="search-input"
            />
          </div>

          {/* Results Table */}
          <div className="table-container">
            <table className="results-table">
              <thead className="table-header">
                <tr>
                  {!uiState.selectedFeatureFilter && (
                    <th className="table-header-cell">Rank</th>
                  )}
                  <th className="table-header-cell">S.No.</th>
                  <th className="table-header-cell">Publication</th>
                  
                  {!uiState.selectedFeatureFilter && features.map((feature, index) => (
                    <th key={index} className="table-header-cell">{feature}</th>
                  ))}
                  
                  {uiState.selectedFeatureFilter && (
                    <th className="table-header-cell feature-highlight">
                      {features[parseInt(uiState.selectedFeatureFilter.split('_')[1]) - 1]}
                    </th>
                  )}
                  
                  <th className="table-header-cell">Analysis Details</th>
                </tr>
              </thead>
              <tbody>
                {paginatedResults.map((result, index) => (
                  <tr key={index} className="table-row">
                    {!uiState.selectedFeatureFilter && (
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
                    
                    {!uiState.selectedFeatureFilter && features.map((feature, featureIndex) => (
                      <td key={featureIndex} className="table-cell table-cell-center">
                        <span className={`badge ${result[`feature_${featureIndex + 1}`] ? 'badge-yes' : 'badge-no'}`}>
                          {result[`feature_${featureIndex + 1}`] ? 'Yes' : 'No'}
                        </span>
                      </td>
                    ))}
                    
                    {uiState.selectedFeatureFilter && (
                      <td className="table-cell table-cell-center feature-highlight-cell">
                        <span className={`badge ${result[uiState.selectedFeatureFilter] ? 'badge-yes' : 'badge-no'}`}>
                          {result[uiState.selectedFeatureFilter] ? 'Yes' : 'No'}
                        </span>
                      </td>
                    )}
                    
                    <td className="table-cell table-cell-center">
                      <button 
                        className="details-btn"
                        onClick={() => showAnalysisDetails(result)}
                        disabled={!result.detailed_analysis || (result.rank !== 1 && result.rank !== 2)}
                        title={
                          result.rank === 1 || result.rank === 2 
                            ? "View detailed analysis" 
                            : "Analysis details only available for Rank 1 & 2 patents"
                        }
                      >
                        <Eye size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pagination">
              <p className="pagination-info">
                Showing <span className="pagination-info-bold">{((uiState.currentPage - 1) * resultsPerPage) + 1}</span> to <span className="pagination-info-bold">{Math.min(uiState.currentPage * resultsPerPage, filteredResults.length)}</span> of <span className="pagination-info-bold">{filteredResults.length}</span> results
              </p>
              <div className="pagination-controls">
                <button
                  onClick={() => updateUiState({ currentPage: Math.max(1, uiState.currentPage - 1) })}
                  disabled={uiState.currentPage === 1}
                  className="pagination-button"
                >
                  Previous
                </button>
                
                <div className="pagination-numbers">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (uiState.currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (uiState.currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = uiState.currentPage - 2 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => updateUiState({ currentPage: pageNum })}
                        className={`pagination-button ${uiState.currentPage === pageNum ? 'active' : ''}`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                
                <button
                  onClick={() => updateUiState({ currentPage: Math.min(totalPages, uiState.currentPage + 1) })}
                  disabled={uiState.currentPage === totalPages}
                  className="pagination-button"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Analysis Details Modal */}
      {uiState.showAnalysisModal && uiState.selectedAnalysis && uiState.selectedAnalysis.detailed_analysis && (
        <div className="modal-overlay" onClick={closeAnalysisModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                Detailed Analysis - Claim {uiState.selectedAnalysis.claimNumber}
              </h2>
              <button className="close-btn" onClick={closeAnalysisModal}>×</button>
            </div>
            
            <div className="modal-content">
              {/* Claim Info */}
              <div className="claim-info">
                <div className="claim-meta">
                  <div className="meta-item">
                    <span className="meta-label">Patent:</span>
                    <span className="meta-value">{uiState.selectedAnalysis.publicationNumber || 'N/A'}</span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-label">Rank:</span>
                    <span className="meta-value">
                      {uiState.selectedAnalysis.rank ? `${uiState.selectedAnalysis.rank} (${uiState.selectedAnalysis.featureCount}/${features.length} features)` : `No Rank (0/${features.length} features)`}
                    </span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-label">Analysis Date:</span>
                    <span className="meta-value">{new Date().toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              {/* Analysis Grid */}
              <div className="analysis-grid">
                {features.map((feature, index) => {
                  const featureKey = `feature_${index + 1}`;
                  const featureAnalysis = uiState.selectedAnalysis.detailed_analysis[featureKey];
                  
                  // Skip if filtering by specific feature and this isn't it
                  if (uiState.selectedFeatureFilter && uiState.selectedFeatureFilter !== featureKey) {
                    return null;
                  }

                  // Fallback if no analysis data
                  if (!featureAnalysis) {
                    return (
                      <div key={featureKey} className="feature-analysis absent">
                        <div className="feature-header">
                          <div className="feature-name">
                            <span>✗</span>
                            {feature}
                          </div>
                          <div className="confidence-score confidence-low">No Data</div>
                        </div>
                        <div className="feature-details">
                          <h4>Analysis Reasoning:</h4>
                          <p>No analysis data available for this feature.</p>
                          <div className="error-note">
                            <strong>Note:</strong> Expected key "{featureKey}" not found in analysis results.
                          </div>
                        </div>
                      </div>
                    );
                  }

                  const confidenceClass = featureAnalysis.confidence?.toLowerCase() === 'high' ? 'confidence-high' : 
                                        featureAnalysis.confidence?.toLowerCase() === 'medium' ? 'confidence-medium' : 'confidence-low';

                  return (
                    <div key={featureKey} className={`feature-analysis ${featureAnalysis.present ? 'present' : 'absent'}`}>
                      <div className="feature-header">
                        <div className="feature-name">
                          <span>{featureAnalysis.present ? '✓' : '✗'}</span>
                          {featureAnalysis.feature_name || feature}
                        </div>
                        <div className={`confidence-score ${confidenceClass}`}>
                          {featureAnalysis.confidence || 'Unknown'} Confidence
                        </div>
                      </div>
                      <div className="feature-details">
                        <h4>Analysis Reasoning:</h4>
                        <p>{featureAnalysis.reasoning || 'No reasoning provided'}</p>
                        
                        {featureAnalysis.relevant_claims && featureAnalysis.relevant_claims !== 'N/A' && (
                          <>
                            <h4>Relevant Claims:</h4>
                            <div className="claims-found">
                              <span className="claim-tag">{featureAnalysis.relevant_claims}</span>
                            </div>
                          </>
                        )}
                        
                        {!featureAnalysis.relevant_claims && featureAnalysis.relevant_text && featureAnalysis.relevant_text !== 'N/A' && (
                          <>
                            <h4>Relevant Text:</h4>
                            <div className="claims-found">
                              <span className="claim-tag">{featureAnalysis.relevant_text}</span>
                            </div>
                          </>
                        )}
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

export default Screening;