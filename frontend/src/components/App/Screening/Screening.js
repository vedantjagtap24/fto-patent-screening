import React, { useState, useCallback } from 'react';
import { Upload, Play, Download, AlertCircle, CheckCircle, Clock, Eye, Plus, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import './Screening.css';

const Screening = ({ 
  backendStatus,
  // All processing state from MainLayout
  file,
  setFile,
  claims,
  setClaims,
  isProcessing,
  progress,
  results,
  error,
  setError,
  processedCount,
  currentlyProcessing,
  elapsedTime,
  features,
  addFeature,
  removeFeature,
  startBulkScreening,
  clearAllData,
  formatElapsedTime
}) => {
  // Only UI state remains in component
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRankFilter, setSelectedRankFilter] = useState(null);
  const [selectedFeatureFilter, setSelectedFeatureFilter] = useState(null);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [selectedAnalysis, setSelectedAnalysis] = useState(null);
  const [newFeature, setNewFeature] = useState('');
  const [showFeatureDropdown, setShowFeatureDropdown] = useState(false);
  const [showRankDropdown, setShowRankDropdown] = useState(false);

  const resultsPerPage = 10;

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
    switch (rank) {
      case 1: return 'rank-1';
      case 2: return 'rank-2';
      case 3: return 'rank-3';
      case 4: return 'rank-4';
      default: return 'rank-none';
    }
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

  // Filter to show only Rank 1 & 2 by default, unless specific filter is applied
  const getDefaultFilteredResults = (rankedResults) => {
    // If user has selected a specific rank filter, respect it
    if (selectedRankFilter !== null) {
      if (selectedRankFilter === 'none') {
        return rankedResults.filter(result => result.rank === null);
      } else {
        return rankedResults.filter(result => result.rank === selectedRankFilter);
      }
    }
    
    // Default: show only Rank 1 and Rank 2 (high priority patents)
    return rankedResults.filter(result => result.rank === 1 || result.rank === 2);
  };

  const getFeatureStats = (results) => {
    const stats = { total: results.length };
    features.forEach((feature, index) => {
      stats[`feature_${index + 1}`] = results.filter(r => r[`feature_${index + 1}`]).length;
    });
    return stats;
  };

  // UPDATED: More flexible publication number detection
  const findPublicationColumn = (jsonData) => {
    if (!jsonData || jsonData.length === 0) return null;
    
    const firstRow = jsonData[0];
    const possibleColumns = [
      'Publication Number',
      'Publication',
      'Pub Number', 
      'Patent Number',
      'Patent Publication',
      'Publication No',
      'Pub No',
      'Patent No'
    ];
    
    // Try exact matches first
    for (const col of possibleColumns) {
      if (firstRow.hasOwnProperty(col)) {
        return col;
      }
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
        
        // UPDATED: Detect publication column automatically
        const publicationColumn = findPublicationColumn(jsonData);
        console.log('Detected publication column:', publicationColumn);
        
        // Add publication number to each claim if detected
        if (publicationColumn) {
          jsonData.forEach(claim => {
            if (!claim['Publication Number'] && claim[publicationColumn]) {
              claim['Publication Number'] = claim[publicationColumn];
            }
          });
        }
        
        setClaims(jsonData);
        setCurrentPage(1);
        setSearchTerm('');
        setSelectedRankFilter(null);
        setSelectedFeatureFilter(null);
      } catch (err) {
        setError('Error parsing Excel file: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(uploadedFile);
  }, [setFile, setClaims, setError]);

  const handleAddFeature = () => {
    if (addFeature(newFeature)) {
      setNewFeature('');
    }
  };

  const rankedResults = processResultsWithRanking(results);
  
  // Apply default filtering (Rank 1 & 2 only) unless specific filter selected
  const defaultFilteredResults = getDefaultFilteredResults(rankedResults);
  
  const featureFilteredResults = selectedFeatureFilter 
    ? defaultFilteredResults.filter(result => result[selectedFeatureFilter] === true)
    : defaultFilteredResults;

  const searchFilteredResults = featureFilteredResults.filter(result => 
    result.claimNumber.toString().includes(searchTerm) ||
    (result.publicationNumber && result.publicationNumber.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Remove the additional rank filtering since it's already handled in getDefaultFilteredResults
  const sortedResults = searchFilteredResults.sort((a, b) => {
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
    // Prevent body scroll when modal opens
    document.body.style.overflow = 'hidden';
  };

  const closeAnalysisModal = () => {
    setShowAnalysisModal(false);
    setSelectedAnalysis(null);
    // Restore body scroll when modal closes
    document.body.style.overflow = 'unset';
  };

  const renderFeatureFilters = () => {
    const stats = getFeatureStats(results);
    
    const rankStats = {
      rank1: rankedResults.filter(r => r.rank === 1).length,
      rank2: rankedResults.filter(r => r.rank === 2).length,
      rank3: rankedResults.filter(r => r.rank === 3).length,
      rank4: rankedResults.filter(r => r.rank === 4).length,
      noRank: rankedResults.filter(r => r.rank === null).length
    };

    const ranks = [
      { key: 1, label: `Rank 1 (${features.length} Features)`, count: rankStats.rank1 },
      { key: 2, label: `Rank 2 (${Math.ceil(features.length * 0.75)}+ Features)`, count: rankStats.rank2 },
      { key: 3, label: `Rank 3 (${Math.ceil(features.length * 0.5)}+ Features)`, count: rankStats.rank3 },
      { key: 4, label: 'Rank 4 (1+ Feature)', count: rankStats.rank4 },
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
      setShowFeatureDropdown(false);
    };

    const handleRankFilter = (rankKey) => {
      if (selectedRankFilter === rankKey) {
        setSelectedRankFilter(null);
      } else {
        setSelectedRankFilter(rankKey);
        setSelectedFeatureFilter(null);
      }
      setCurrentPage(1);
      setShowRankDropdown(false);
    };

    const clearAllFilters = () => {
      setSelectedFeatureFilter(null);
      setSelectedRankFilter(null);
      setSearchTerm('');
      setCurrentPage(1);
      setShowFeatureDropdown(false);
      setShowRankDropdown(false);
    };

    return (
      <div className="dropdown-filters">
        <div className="filters-header">
          <div className="filters-title-section">
            <h3 className="filters-title">Filters & Export</h3>
            <div className="results-summary">
              <span className="summary-text">
                Showing {sortedResults.length} of {stats.total} patents
                {selectedFeatureFilter && ` • ${features[parseInt(selectedFeatureFilter.split('_')[1]) - 1]}`}
                {selectedRankFilter !== null && ` • ${ranks.find(r => r.key === selectedRankFilter)?.label}`}
                {selectedRankFilter === null && selectedFeatureFilter === null && ` • High Priority (Rank 1 & 2)`}
                {searchTerm && ` • Search: "${searchTerm}"`}
              </span>
            </div>
          </div>
          
          {(selectedFeatureFilter || selectedRankFilter || searchTerm) && (
            <button onClick={clearAllFilters} className="clear-all-btn">
              Clear All Filters
            </button>
          )}
        </div>

        <div className="dropdown-filters-row">
          {/* Modern Feature Dropdown */}
          <div className="filter-dropdown modern-dropdown">
            <button 
              className={`modern-filter-btn ${selectedFeatureFilter ? 'selected' : ''}`}
              onClick={() => setShowFeatureDropdown(!showFeatureDropdown)}
            >
              <span>
                {selectedFeatureFilter 
                  ? features[parseInt(selectedFeatureFilter.split('_')[1]) - 1]
                  : 'Filter by Feature'
                }
              </span>
              <svg 
                className={`dropdown-arrow ${showFeatureDropdown ? 'rotated' : ''}`}
                width="16" 
                height="16" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2"
              >
                <path d="M6 9l6 6 6-6"/>
              </svg>
            </button>
            
            {showFeatureDropdown && (
              <div className="modern-dropdown-menu">
                <div 
                  className="modern-dropdown-option"
                  onClick={() => handleFeatureFilter(null)}
                >
                  <span>All Features</span>
                </div>
                {features.map((feature, index) => {
                  const key = `feature_${index + 1}`;
                  const count = stats[key] || 0;
                  return (
                    <div
                      key={key}
                      className={`modern-dropdown-option ${count === 0 ? 'disabled' : ''} ${selectedFeatureFilter === key ? 'selected' : ''}`}
                      onClick={() => count > 0 && handleFeatureFilter(key)}
                    >
                      <span>{feature}</span>
                      <span className="option-count">({count})</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Modern Rank Dropdown */}
          <div className="filter-dropdown modern-dropdown">
            <button 
              className={`modern-filter-btn ${selectedRankFilter !== null ? 'selected' : ''}`}
              onClick={() => setShowRankDropdown(!showRankDropdown)}
            >
              <span>
                {selectedRankFilter !== null 
                  ? ranks.find(r => r.key === selectedRankFilter)?.label || 'Filter by Rank'
                  : 'Filter by Rank'
                }
              </span>
              <svg 
                className={`dropdown-arrow ${showRankDropdown ? 'rotated' : ''}`}
                width="16" 
                height="16" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2"
              >
                <path d="M6 9l6 6 6-6"/>
              </svg>
            </button>
            
            {showRankDropdown && (
              <div className="modern-dropdown-menu">
                <div 
                  className="modern-dropdown-option"
                  onClick={() => handleRankFilter(null)}
                >
                  <span>All Ranks</span>
                </div>
                {ranks.map((rank) => (
                  <div
                    key={rank.key}
                    className={`modern-dropdown-option ${rank.count === 0 ? 'disabled' : ''} ${selectedRankFilter === rank.key ? 'selected' : ''}`}
                    onClick={() => rank.count > 0 && handleRankFilter(rank.key)}
                  >
                    <span>{rank.label}</span>
                    <span className="option-count">({rank.count})</span>
                  </div>
                ))}
              </div>
            )}
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
      if (!selectedFeatureFilter && result.detailed_analysis) {
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

          {/* Feature Configuration Section */}
          {claims.length > 0 && (
            <div style={{ 
              marginTop: '2rem',
              padding: '1.5rem',
              background: 'white',
              borderRadius: '1rem',
              border: '1px solid #e5e7eb'
            }}>
              <h3 style={{ 
                marginBottom: '1rem', 
                fontWeight: '600',
                color: '#111827'
              }}>
                What features do you want to find?
              </h3>

              {/* Current Features */}
              {features.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <h4 style={{ 
                    marginBottom: '0.5rem',
                    color: '#374151'
                  }}>
                    Features to analyze ({features.length}):
                  </h4>
                  <div style={{ 
                    display: 'flex', 
                    flexWrap: 'wrap', 
                    gap: '0.5rem', 
                    marginBottom: '1rem' 
                  }}>
                    {features.map((feature, index) => (
                      <div key={index} className="feature-badge" style={{ 
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem 0.75rem'
                      }}>
                        <span>{feature}</span>
                        <button
                          onClick={() => removeFeature(index)}
                          style={{ 
                            background: 'none',
                            border: 'none',
                            color: 'inherit',
                            cursor: 'pointer',
                            padding: '0',
                            display: 'flex'
                          }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add New Feature */}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  value={newFeature}
                  onChange={(e) => setNewFeature(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddFeature()}
                  placeholder="Type a feature (e.g., 'wireless connectivity', 'machine learning')"
                  style={{ 
                    flex: 1,
                    padding: '0.5rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.375rem'
                  }}
                />
                <button
                  onClick={handleAddFeature}
                  className="start-button-centered"
                  style={{ 
                    minWidth: 'auto',
                    padding: '0.5rem 1rem'
                  }}
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

          {/* UPDATED: Enhanced Progress Section with Real-time Updates & Time Estimates */}
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
                <div
                  className="progress-fill"
                  style={{ width: `${progress}%` }}
                />
              </div>
              
              {/* Show estimated time remaining */}
              {processedCount > 0 && processedCount < claims.length && (
                <div style={{ 
                  fontSize: '0.75rem', 
                  color: '#6b7280', 
                  textAlign: 'center', 
                  marginTop: '0.5rem' 
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
              <span className="results-badge">
                {results.length} processed
              </span>
            </h2>
          </div>

          {renderFeatureFilters()}

          <div className="search-container">
            <input
              type="text"
              placeholder="Search patent or publication number..."
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
                  <th className="table-header-cell">S.No.</th>
                  <th className="table-header-cell">Publication</th>
                  
                  {!selectedFeatureFilter && features.map((feature, index) => (
                    <th key={index} className="table-header-cell">{feature}</th>
                  ))}
                  
                  {selectedFeatureFilter && (
                    <th className="table-header-cell feature-highlight">
                      {features[parseInt(selectedFeatureFilter.split('_')[1]) - 1]}
                    </th>
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
                    
                    {!selectedFeatureFilter && features.map((feature, featureIndex) => (
                      <td key={featureIndex} className="table-cell table-cell-center">
                        <span className={`badge ${result[`feature_${featureIndex + 1}`] ? 'badge-yes' : 'badge-no'}`}>
                          {result[`feature_${featureIndex + 1}`] ? 'Yes' : 'No'}
                        </span>
                      </td>
                    ))}
                    
                    {selectedFeatureFilter && (
                      <td className="table-cell table-cell-center feature-highlight-cell">
                        <span className={`badge ${result[selectedFeatureFilter] ? 'badge-yes' : 'badge-no'}`}>
                          {result[selectedFeatureFilter] ? 'Yes' : 'No'}
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

      {/* Analysis Details Modal */}
      {showAnalysisModal && selectedAnalysis && selectedAnalysis.detailed_analysis && (
        <div className="modal-overlay" onClick={closeAnalysisModal}>
          <div 
            className="modal" 
            onClick={(e) => e.stopPropagation()}
            onScroll={(e) => e.stopPropagation()}
          >
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
                      {selectedAnalysis.rank ? `${selectedAnalysis.rank} (${selectedAnalysis.featureCount}/${features.length} features)` : `No Rank (0/${features.length} features)`}
                    </span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-label">Analysis Date:</span>
                    <span className="meta-value">{new Date().toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              <div className="analysis-grid">
                {Object.entries(selectedAnalysis.detailed_analysis).filter(([key]) => {
                  if (selectedFeatureFilter) {
                    return key === selectedFeatureFilter;
                  }
                  return true;
                }).map(([key, featureAnalysis]) => {
                  if (!featureAnalysis) return null;

                  const confidenceClass = featureAnalysis.confidence?.toLowerCase() === 'high' ? 'confidence-high' : 
                                        featureAnalysis.confidence?.toLowerCase() === 'medium' ? 'confidence-medium' : 'confidence-low';

                  return (
                    <div key={key} className={`feature-analysis ${featureAnalysis.present ? 'present' : 'absent'}`}>
                      <div className="feature-header">
                        <div className="feature-name">
                          <span>{featureAnalysis.present ? '✓' : '✗'}</span>
                          {featureAnalysis.feature_name}
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
                        
                        {/* Fallback to relevant_text if relevant_claims not available */}
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