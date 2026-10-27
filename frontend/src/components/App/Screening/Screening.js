import React, { useState, useCallback } from 'react';
import { UploadCloud, Play, Download, AlertCircle, CheckCircle, Clock, Eye, Plus, X, Search, ChevronDown, RotateCcw, ExternalLink, FileSpreadsheet, Info, Square, Lock, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import './Screening.css';

const Screening = ({ 
  backendStatus, file, setFile, claims, setClaims, isProcessing, progress, results, error, setError,
  processedCount, currentlyProcessing, elapsedTime, features, addFeature, removeFeature,
  startBulkScreening, resumeAnalysis, cancelAnalysis, clearAllData, formatElapsedTime, notice,
  progressTotal, etaMs, resumable, runFailed, lastFailure, throttled,
  analysisLocked, loadClaimTexts, dataLoading
}) => {
  const [uiState, setUiState] = useState({
    searchTerm: '', currentPage: 1, selectedRankFilter: null, selectedFeatureFilter: null,
    showAnalysisModal: false, selectedAnalysis: null, newFeature: '',
    showFeatureDropdown: false, showRankDropdown: false,
    showLockedModal: false, exporting: false
  });

  const updateUiState = (updates) => setUiState(prev => ({ ...prev, ...updates }));
  const resultsPerPage = 10;

  const calculateRank = (result) => {
    const featureCount = features.filter((_, index) => result[`feature_${index + 1}`] === true).length;
    if (featureCount === features.length) return 1;
    if (featureCount >= Math.ceil(features.length * 0.75)) return 2;
    if (featureCount >= Math.ceil(features.length * 0.5)) return 3;
    return featureCount >= 1 ? 4 : null;
  };

  const processResultsWithRanking = (results) => results.map(result => ({
    ...result,
    rank: calculateRank(result),
    featureCount: features.filter((_, index) => result[`feature_${index + 1}`] === true).length
  }));

  const getFilteredResults = (rankedResults) => {
    let filtered = rankedResults;
    
    if (uiState.selectedRankFilter !== null) {
      filtered = filtered.filter(result => 
        uiState.selectedRankFilter === 'none' ? result.rank === null : result.rank === uiState.selectedRankFilter
      );
    } else {
      filtered = filtered.filter(result => result.rank === 1 || result.rank === 2);
    }

    if (uiState.selectedFeatureFilter) {
      filtered = filtered.filter(result => result[uiState.selectedFeatureFilter] === true);
    }

    return filtered
      .filter(result => 
        result.claimNumber.toString().includes(uiState.searchTerm) ||
        (result.publicationNumber && result.publicationNumber.toLowerCase().includes(uiState.searchTerm.toLowerCase()))
      )
      .sort((a, b) => {
        if (a.rank === null && b.rank === null) return 0;
        if (a.rank === null) return 1;
        if (b.rank === null) return -1;
        return a.rank - b.rank;
      });
  };

  const findPublicationColumn = (jsonData) => {
    if (!jsonData || jsonData.length === 0) return null;
    
    const firstRow = jsonData[0];
    const possibleColumns = ['Publication Number', 'Publication', 'Pub Number', 'Patent Number'];
    
    return possibleColumns.find(col => firstRow.hasOwnProperty(col)) || 
           Object.keys(firstRow).find(column => {
             const lowerColumn = column.toLowerCase();
             return lowerColumn.includes('publication') || lowerColumn.includes('patent') || lowerColumn.includes('pub');
           });
  };

  const handleFileUpload = useCallback((event) => {
    const uploadedFile = event.target.files[0];
    if (!uploadedFile) return;

    if (!uploadedFile.name.match(/\.(xlsx|xls)$/)) {
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
        const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        
        const publicationColumn = findPublicationColumn(jsonData);
        if (publicationColumn) {
          jsonData.forEach(claim => {
            if (!claim['Publication Number'] && claim[publicationColumn]) {
              claim['Publication Number'] = claim[publicationColumn];
            }
          });
        }
        
        setClaims(jsonData);
        updateUiState({ currentPage: 1, searchTerm: '', selectedRankFilter: null, selectedFeatureFilter: null });
      } catch (err) {
        setError('Error parsing Excel file: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(uploadedFile);
  }, [setFile, setClaims, setError]);

  const handleFilter = (type, key) => {
    const updates = { currentPage: 1 };
    if (type === 'feature') {
      updates.selectedFeatureFilter = uiState.selectedFeatureFilter === key ? null : key;
      updates.selectedRankFilter = null;
      updates.showFeatureDropdown = false;
    } else {
      updates.selectedRankFilter = uiState.selectedRankFilter === key ? null : key;
      updates.selectedFeatureFilter = null;
      updates.showRankDropdown = false;
    }
    updateUiState(updates);
  };

  const exportResults = async () => {
    if (results.length === 0) return;
    const filteredResults = getFilteredResults(processResultsWithRanking(results));
    if (filteredResults.length === 0) return alert('No results to export. Please adjust your filters.');

    // Claims loaded from the server come without their text; fetch it for the export
    let claimText = (result) => (claims.find(c => (c['S.No.'] || claims.indexOf(c) + 1) === result.claimNumber) || {}).Claims || '';
    if (claims.length > 0 && claims[0].Claims === undefined) {
      updateUiState({ exporting: true });
      try {
        const texts = await loadClaimTexts();
        claimText = (result) => texts.get(result.claimNumber) || '';
      } catch (err) {
        setError('Could not load claim text for the export: ' + err.message);
      } finally {
        updateUiState({ exporting: false });
      }
    }

    const exportData = filteredResults.map((result) => {
      const data = {
        'S.No.': result.claimNumber,
        'Publication Number': result.publicationNumber || '',
        'Claims': claimText(result),
        'Rank': result.rank || 'No Rank',
        'Feature Count': `${result.featureCount}/${features.length}`
      };

      features.forEach((feature, index) => {
        data[feature] = result[`feature_${index + 1}`] ? 'Yes' : 'No';
      });

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

  const { stats, rankStats, rankedResults } = getStats();
  const filteredResults = getFilteredResults(rankedResults);
  const totalPages = Math.ceil(filteredResults.length / resultsPerPage);
  const paginatedResults = filteredResults.slice(
    (uiState.currentPage - 1) * resultsPerPage,
    uiState.currentPage * resultsPerPage
  );

  const featureOptions = features.map((feature, index) => ({
    key: `feature_${index + 1}`,
    label: feature,
    count: stats[`feature_${index + 1}`] || 0
  }));

  const rankOptions = [
    { key: 1, label: `Rank 1 (${features.length} Features)`, count: rankStats.rank1 },
    { key: 2, label: `Rank 2 (${Math.ceil(features.length * 0.75)}+ Features)`, count: rankStats.rank2 },
    { key: 3, label: `Rank 3 (${Math.ceil(features.length * 0.5)}+ Features)`, count: rankStats.rank3 },
    { key: 4, label: 'Rank 4 (1+ Feature)', count: rankStats.rank4 },
    { key: 'none', label: 'No Rank (0 Features)', count: rankStats.noRank }
  ];

  const rankDescriptions = {
    1: 'All features',
    2: '75%+ of features',
    3: '50%+ of features',
    4: 'At least 1 feature'
  };

  const featureLabel = (key) => features[parseInt(key.split('_')[1]) - 1];

  const closeAnalysisModal = () => {
    updateUiState({ showAnalysisModal: false, selectedAnalysis: null });
    document.body.style.overflow = 'unset';
  };

  const FilterDropdown = ({ type, options, selected, show, setShow }) => (
    <div className="filter-dropdown">
      <button 
        className={`filter-btn ${selected !== null ? 'selected' : ''}`}
        onClick={() => setShow(!show)}
      >
        <span className="filter-btn-label">
          {type === 'feature' 
            ? (selected ? featureLabel(selected) : 'All features')
            : (selected !== null ? options.find(r => r.key === selected)?.label || 'Rank 1 & 2' : 'Rank 1 & 2')
          }
        </span>
        <ChevronDown size={16} className={`dropdown-arrow ${show ? 'rotated' : ''}`} />
      </button>
      
      {show && (
        <div className="filter-menu">
          <div className="filter-option" onClick={() => handleFilter(type, null)}>
            <span>{type === 'feature' ? 'All features' : 'Rank 1 & 2 (default)'}</span>
          </div>
          {options.map((option) => (
            <div
              key={option.key}
              className={`filter-option ${option.count === 0 ? 'disabled' : ''} ${selected === option.key ? 'selected' : ''}`}
              onClick={() => option.count > 0 && handleFilter(type, option.key)}
            >
              <span>{option.label}</span>
              <span className="option-count">{option.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const canStart = claims.length > 0 && features.length > 0 && !isProcessing && backendStatus === 'connected';

  // Claims the server couldn't analyze; the reason is stored in place of the AI's reasoning
  const failedResults = results.filter(r => r.detailed_analysis?.feature_1?.reasoning?.startsWith('Analysis failed'));
  const failedReason = (lastFailure || failedResults[0]?.detailed_analysis.feature_1.reasoning || '')
    .replace(/^Analysis failed - /, '');

  return (
    <div className="screening">
      {/* ===== SETUP ===== */}
      <div className="setup-grid">
        <section className="setup-card card">
          <div className="setup-card-header">
            <span className="step-badge">1</span>
            <div>
              <h2 className="setup-title">Upload patent claims</h2>
              <p className="setup-subtitle">Excel file with S.No., Publication Number and Claims columns</p>
            </div>
          </div>

          {analysisLocked || (dataLoading && claims.length === 0) ? (
            <div className={`dropzone dropzone-static ${claims.length > 0 ? 'has-file' : ''}`}>
              {claims.length > 0 ? (
                <>
                  <FileSpreadsheet size={28} className="dropzone-icon" />
                  <span className="dropzone-title">Patent claims dataset</span>
                  <span className="dropzone-meta">
                    <CheckCircle size={14} /> {claims.length} patents loaded
                  </span>
                </>
              ) : (
                <>
                  <Loader2 size={28} className="dropzone-icon spin" />
                  <span className="dropzone-title">Loading dataset…</span>
                </>
              )}
            </div>
          ) : (
          <label htmlFor="file-upload" className={`dropzone ${claims.length > 0 ? 'has-file' : ''}`}>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              onClick={(e) => { e.target.value = null; }}
              className="visually-hidden"
              id="file-upload"
            />
            {claims.length > 0 ? (
              <>
                <FileSpreadsheet size={28} className="dropzone-icon" />
                <span className="dropzone-title">{file ? file.name : 'Claims from your last project'}</span>
                <span className="dropzone-meta">
                  <CheckCircle size={14} /> {claims.length} patents detected · Click to replace
                </span>
              </>
            ) : (
              <>
                <UploadCloud size={28} className="dropzone-icon" />
                <span className="dropzone-title">Click to upload an Excel file</span>
                <span className="dropzone-meta">.xlsx or .xls</span>
              </>
            )}
          </label>
          )}
        </section>

        <section className="setup-card card">
          <div className="setup-card-header">
            <span className="step-badge">2</span>
            <div>
              <h2 className="setup-title">Product features</h2>
              <p className="setup-subtitle">What should each claim be checked for?</p>
            </div>
          </div>

          {!analysisLocked && (
          <div className="feature-input-row">
            <input
              type="text"
              className="input"
              value={uiState.newFeature}
              onChange={(e) => updateUiState({ newFeature: e.target.value })}
              onKeyPress={(e) => e.key === 'Enter' && addFeature(uiState.newFeature) && updateUiState({ newFeature: '' })}
              placeholder="e.g. Tremor reduction technology"
            />
            <button
              onClick={() => addFeature(uiState.newFeature) && updateUiState({ newFeature: '' })}
              className="btn btn-secondary"
              disabled={!uiState.newFeature.trim()}
            >
              <Plus size={16} />
              Add
            </button>
          </div>
          )}

          {features.length > 0 ? (
            <ol className="feature-list">
              {features.map((feature, index) => (
                <li key={index} className="feature-item">
                  <span className="feature-index">{index + 1}</span>
                  <span className="feature-text">{feature}</span>
                  {!analysisLocked && (
                    <button className="icon-btn feature-remove" onClick={() => removeFeature(index)} title="Remove feature">
                      <X size={14} />
                    </button>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <p className="feature-empty">{dataLoading ? 'Loading features…' : 'No features yet. Add one at a time and press Enter.'}</p>
          )}
        </section>
      </div>

      {/* ===== RUN BAR ===== */}
      <section className="run-bar card">
        <div className="run-bar-main">
          <div className="run-summary">
            <span className="step-badge">3</span>
            <div>
              <h2 className="setup-title">Run analysis</h2>
              <p className="setup-subtitle">
                {claims.length > 0 && features.length > 0
                  ? `${claims.length} patents × ${features.length} features`
                  : 'Upload claims and add at least one feature to start'}
              </p>
            </div>
          </div>
          {analysisLocked ? (
          <div className="run-actions">
            <button onClick={() => updateUiState({ showLockedModal: true })} className="btn btn-primary btn-lg">
              <Play size={16} />
              Run analysis
            </button>
          </div>
          ) : (
          <div className="run-actions">
            {(claims.length > 0 || features.length > 0 || results.length > 0) && !isProcessing && (
              <button className="btn btn-ghost" onClick={clearAllData}>
                <RotateCcw size={16} />
                Start over
              </button>
            )}
            {isProcessing && (
              <button className="btn btn-secondary btn-lg" onClick={cancelAnalysis}>
                <Square size={14} />
                Cancel
              </button>
            )}
            {resumable && !isProcessing ? (
              <>
                <button onClick={startBulkScreening} disabled={!canStart} className="btn btn-secondary btn-lg">
                  Start from scratch
                </button>
                <button onClick={resumeAnalysis} disabled={backendStatus !== 'connected'} className="btn btn-primary btn-lg">
                  <Play size={16} />
                  {processedCount < progressTotal
                    ? `Resume (${processedCount} of ${progressTotal} done)`
                    : `Retry ${failedResults.length} failed`}
                </button>
              </>
            ) : (
              <button onClick={startBulkScreening} disabled={!canStart} className="btn btn-primary btn-lg">
                <Play size={16} />
                {isProcessing ? 'Analyzing…' : 'Start analysis'}
              </button>
            )}
          </div>
          )}
        </div>

        {isProcessing && (
          <div className="progress">
            <div className="progress-row">
              <span className="progress-percent">{Math.round(progress)}%</span>
              <span className="progress-label">
                {processedCount} of {progressTotal || claims.length} patents analyzed
                {runFailed > 0 && <span className="progress-failed"> · {runFailed} failed</span>}
              </span>
              <span className="progress-time">
                <Clock size={14} /> {formatElapsedTime(elapsedTime)}
                {etaMs != null && <> · about {formatElapsedTime(etaMs)} left</>}
              </span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
            {currentlyProcessing && <p className="progress-current">{currentlyProcessing}</p>}
            {throttled && (
              <p className="progress-current">
                OpenAI's per-minute limit was reached, so requests are pacing themselves. Nothing fails because of this.
              </p>
            )}
            {runFailed > 0 && failedReason && (
              <p className="progress-failure">
                <AlertCircle size={14} />
                <span>Latest failure: {failedReason}</span>
              </p>
            )}
          </div>
        )}
      </section>

      {notice && !isProcessing && (
        <div className="alert alert-info">
          <Info size={18} />
          <p>{notice}</p>
        </div>
      )}

      {error && (
        <div className="alert alert-error">
          <AlertCircle size={18} />
          <p>{error}</p>
        </div>
      )}

      {dataLoading && results.length === 0 && (
        <div className="results-loading card">
          <Loader2 size={18} className="spin" />
          Loading results…
        </div>
      )}

      {/* ===== RESULTS ===== */}
      {results.length > 0 && (
        <section className="results">
          <div className="results-heading">
            <h2 className="results-title">Results</h2>
            <span className="results-count">
              {results.length} patents analyzed
              {isProcessing && ' so far · updates every 30 seconds'}
            </span>
          </div>

          {failedResults.length > 0 && !isProcessing && (
            <div className="alert alert-error">
              <AlertCircle size={18} />
              <p>
                {failedResults.length} of {results.length} patents failed to analyze ({failedReason}).
                {resumable && !analysisLocked ? ' Use the Retry or Resume button above to try them again.' : ''}
              </p>
            </div>
          )}

          <div className="stat-grid">
            {[1, 2, 3, 4].map(rank => (
              <button
                key={rank}
                className={`stat-tile card ${uiState.selectedRankFilter === rank ? 'active' : ''}`}
                onClick={() => rankStats[`rank${rank}`] > 0 && handleFilter('rank', rank)}
                disabled={rankStats[`rank${rank}`] === 0}
              >
                <span className={`stat-dot rank-dot-${rank}`} />
                <span className="stat-label">Rank {rank}</span>
                <span className="stat-value">{rankStats[`rank${rank}`]}</span>
                <span className="stat-hint">{rankDescriptions[rank]}</span>
              </button>
            ))}
          </div>

          <div className="results-panel card">
            <div className="toolbar">
              <div className="search-field">
                <Search size={16} className="search-icon" />
                <input
                  type="text"
                  className="input"
                  placeholder="Search S.No. or publication number"
                  value={uiState.searchTerm}
                  onChange={(e) => updateUiState({ searchTerm: e.target.value, currentPage: 1 })}
                />
              </div>

              <FilterDropdown
                type="feature"
                options={featureOptions}
                selected={uiState.selectedFeatureFilter}
                show={uiState.showFeatureDropdown}
                setShow={(show) => updateUiState({ showFeatureDropdown: show, showRankDropdown: false })}
              />

              <FilterDropdown
                type="rank"
                options={rankOptions}
                selected={uiState.selectedRankFilter}
                show={uiState.showRankDropdown}
                setShow={(show) => updateUiState({ showRankDropdown: show, showFeatureDropdown: false })}
              />

              <div className="toolbar-spacer" />

              {(uiState.selectedFeatureFilter || uiState.selectedRankFilter !== null || uiState.searchTerm) && (
                <button onClick={() => updateUiState({
                  selectedFeatureFilter: null, selectedRankFilter: null, searchTerm: '', currentPage: 1,
                  showFeatureDropdown: false, showRankDropdown: false
                })} className="btn btn-ghost">
                  Clear filters
                </button>
              )}

              <button onClick={exportResults} className="btn btn-secondary" disabled={uiState.exporting}>
                {uiState.exporting ? <Loader2 size={16} className="spin" /> : <Download size={16} />}
                {uiState.exporting ? 'Preparing…' : 'Export'}
              </button>
            </div>

            <p className="results-summary">
              Showing {filteredResults.length} of {stats.total} patents
              {uiState.selectedFeatureFilter && ` · ${featureLabel(uiState.selectedFeatureFilter)}`}
              {uiState.selectedRankFilter !== null && ` · ${rankOptions.find(r => r.key === uiState.selectedRankFilter)?.label}`}
              {uiState.selectedRankFilter === null && uiState.selectedFeatureFilter === null && ' · High priority (Rank 1 & 2)'}
              {uiState.searchTerm && ` · “${uiState.searchTerm}”`}
            </p>

            <div className="table-scroll">
              <table className="results-table">
                <thead>
                  <tr>
                    {!uiState.selectedFeatureFilter && <th>Rank</th>}
                    <th>S.No.</th>
                    <th>Publication</th>
                    {!uiState.selectedFeatureFilter && features.map((feature, index) => (
                      <th key={index} className="th-feature" title={feature}>{feature}</th>
                    ))}
                    {uiState.selectedFeatureFilter && (
                      <th className="th-feature">{featureLabel(uiState.selectedFeatureFilter)}</th>
                    )}
                    <th className="th-right">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedResults.length === 0 && (
                    <tr>
                      <td colSpan={features.length + 4} className="table-empty">
                        No patents match these filters.
                      </td>
                    </tr>
                  )}
                  {paginatedResults.map((result, index) => (
                    <tr key={index}>
                      {!uiState.selectedFeatureFilter && (
                        <td>
                          <span className={`rank-badge ${result.rank ? `rank-${result.rank}` : 'rank-none'}`}>
                            {result.rank || '–'}
                          </span>
                        </td>
                      )}
                      <td className="td-number">{result.claimNumber}</td>
                      <td>
                        {result.publicationNumber && result.publicationNumber !== 'N/A' ? (
                          <a href={`https://patents.google.com/patent/${result.publicationNumber}`}
                            target="_blank" rel="noopener noreferrer" className="publication-link"
                            title={`View ${result.publicationNumber} on Google Patents`}>
                            {result.publicationNumber}
                            <ExternalLink size={12} />
                          </a>
                        ) : (
                          <span className="muted">N/A</span>
                        )}
                      </td>
                      
                      {!uiState.selectedFeatureFilter && features.map((feature, featureIndex) => (
                        <td key={featureIndex}>
                          <span className={`match ${result[`feature_${featureIndex + 1}`] ? 'match-yes' : 'match-no'}`}>
                            {result[`feature_${featureIndex + 1}`] ? 'Yes' : 'No'}
                          </span>
                        </td>
                      ))}
                      
                      {uiState.selectedFeatureFilter && (
                        <td>
                          <span className={`match ${result[uiState.selectedFeatureFilter] ? 'match-yes' : 'match-no'}`}>
                            {result[uiState.selectedFeatureFilter] ? 'Yes' : 'No'}
                          </span>
                        </td>
                      )}
                      
                      <td className="td-right">
                        <button 
                          className="icon-btn"
                          onClick={() => {
                            updateUiState({ selectedAnalysis: result, showAnalysisModal: true });
                            document.body.style.overflow = 'hidden';
                          }}
                          disabled={!result.detailed_analysis || (result.rank !== 1 && result.rank !== 2)}
                          title={result.rank === 1 || result.rank === 2 ? 'View detailed analysis' : 'Details are available for Rank 1 & 2 patents'}
                        >
                          <Eye size={16} />
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
                  {((uiState.currentPage - 1) * resultsPerPage) + 1}–{Math.min(uiState.currentPage * resultsPerPage, filteredResults.length)} of {filteredResults.length}
                </p>
                <div className="pagination-controls">
                  <button
                    onClick={() => updateUiState({ currentPage: Math.max(1, uiState.currentPage - 1) })}
                    disabled={uiState.currentPage === 1}
                    className="page-btn"
                  >
                    Previous
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) pageNum = i + 1;
                    else if (uiState.currentPage <= 3) pageNum = i + 1;
                    else if (uiState.currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                    else pageNum = uiState.currentPage - 2 + i;
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => updateUiState({ currentPage: pageNum })}
                        className={`page-btn ${uiState.currentPage === pageNum ? 'active' : ''}`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => updateUiState({ currentPage: Math.min(totalPages, uiState.currentPage + 1) })}
                    disabled={uiState.currentPage === totalPages}
                    className="page-btn"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ===== DEMO LOCK MODAL ===== */}
      {uiState.showLockedModal && (
        <div className="modal-overlay" onClick={() => updateUiState({ showLockedModal: false })}>
          <div className="modal locked-modal" onClick={(e) => e.stopPropagation()}>
            <span className="locked-icon"><Lock size={22} /></span>
            <h2 className="modal-title">Analysis already completed</h2>
            <p className="locked-text">
              This demo shows a finished screening of {claims.length || progressTotal} patents against {features.length} product features.
              Running a new analysis is turned off because every run uses paid OpenAI credits.
            </p>
            <p className="locked-text">The full results are below. Filter by rank or feature, open any patent's reasoning, or export to Excel.</p>
            <button
              className="btn btn-primary btn-lg"
              onClick={() => {
                updateUiState({ showLockedModal: false });
                document.querySelector('.results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
            >
              View results
            </button>
          </div>
        </div>
      )}

      {/* ===== DETAIL MODAL ===== */}
      {uiState.showAnalysisModal && uiState.selectedAnalysis?.detailed_analysis && (
        <div className="modal-overlay" onClick={closeAnalysisModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">Claim {uiState.selectedAnalysis.claimNumber}</h2>
                <div className="modal-meta">
                  <span>{uiState.selectedAnalysis.publicationNumber || 'N/A'}</span>
                  <span className={`rank-badge ${uiState.selectedAnalysis.rank ? `rank-${uiState.selectedAnalysis.rank}` : 'rank-none'}`}>
                    {uiState.selectedAnalysis.rank ? `Rank ${uiState.selectedAnalysis.rank}` : 'No rank'}
                  </span>
                  <span>{uiState.selectedAnalysis.featureCount}/{features.length} features matched</span>
                </div>
              </div>
              <button className="icon-btn" onClick={closeAnalysisModal}>
                <X size={20} />
              </button>
            </div>
            
            <div className="modal-body">
              {features.map((feature, index) => {
                const featureKey = `feature_${index + 1}`;
                const featureAnalysis = uiState.selectedAnalysis.detailed_analysis[featureKey];
                
                if (uiState.selectedFeatureFilter && uiState.selectedFeatureFilter !== featureKey) return null;
                if (!featureAnalysis) return (
                  <div key={featureKey} className="analysis-item">
                    <div className="analysis-item-header">
                      <span className="match match-no">No data</span>
                      <h3 className="analysis-feature">{feature}</h3>
                    </div>
                    <p className="analysis-reasoning">No analysis data available for this feature.</p>
                  </div>
                );

                const confidence = featureAnalysis.confidence?.toLowerCase();
                const confidenceClass = confidence === 'high' ? 'confidence-high' : 
                                        confidence === 'medium' ? 'confidence-medium' : 'confidence-low';

                return (
                  <div key={featureKey} className="analysis-item">
                    <div className="analysis-item-header">
                      <span className={`match ${featureAnalysis.present ? 'match-yes' : 'match-no'}`}>
                        {featureAnalysis.present ? 'Present' : 'Absent'}
                      </span>
                      <h3 className="analysis-feature">{featureAnalysis.feature_name || feature}</h3>
                      <span className={`confidence ${confidenceClass}`}>
                        {featureAnalysis.confidence || 'Unknown'} confidence
                      </span>
                    </div>
                    <p className="analysis-reasoning">{featureAnalysis.reasoning || 'No reasoning provided'}</p>
                    
                    {featureAnalysis.relevant_claims && featureAnalysis.relevant_claims !== 'N/A' && (
                      <p className="analysis-claims">
                        <span>Relevant claims</span> {featureAnalysis.relevant_claims}
                      </p>
                    )}
                    
                    {!featureAnalysis.relevant_claims && featureAnalysis.relevant_text && featureAnalysis.relevant_text !== 'N/A' && (
                      <p className="analysis-claims">
                        <span>Relevant text</span> {featureAnalysis.relevant_text}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Screening;
