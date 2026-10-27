import React, { useMemo, useState } from 'react';
import { BarChart3, ArrowRight, ExternalLink, Loader2 } from 'lucide-react';
import useCountUp from '../../../hooks/useCountUp';
import { computeDashboardStats, formatPercent } from './dashboardStats';
import './Dashboard.css';

const RANK_ROWS = [
  { key: 1, label: 'Rank 1', hint: 'all', detail: 'all features' },
  { key: 2, label: 'Rank 2', hint: '75%+', detail: '75%+ of features' },
  { key: 3, label: 'Rank 3', hint: '50%+', detail: '50%+ of features' },
  { key: 4, label: 'Rank 4', hint: '1+', detail: 'at least 1 feature' }
];

// One tooltip for the page; marks report what to show on hover and focus
const useTooltip = () => {
  const [tip, setTip] = useState(null);
  const bind = (content) => ({
    onPointerMove: (e) => setTip({ x: e.clientX, y: e.clientY, content }),
    onPointerLeave: () => setTip(null),
    onFocus: (e) => {
      const rect = e.currentTarget.getBoundingClientRect();
      setTip({ x: rect.left + rect.width / 2, y: rect.top, content });
    },
    onBlur: () => setTip(null),
    tabIndex: 0
  });
  const node = tip && (
    <div className="chart-tooltip" style={{ left: tip.x, top: tip.y }} role="status">
      <strong>{tip.content.value}</strong>
      <span>{tip.content.label}</span>
    </div>
  );
  return { bind, node };
};

const Dashboard = ({ onNavigate, results = [], features = [], dataLoading }) => {
  const stats = useMemo(() => computeDashboardStats(results, features), [results, features]);
  const screened = useCountUp(stats.total);
  const { bind, node: tooltip } = useTooltip();

  if (dataLoading && results.length === 0) {
    return (
      <div className="dashboard-loading card">
        <Loader2 size={18} className="spin" /> Loading dashboard…
      </div>
    );
  }

  if (stats.total === 0) {
    return (
      <div className="dashboard-empty card">
        <span className="dashboard-empty-icon"><BarChart3 size={24} /></span>
        <h2>No analysis yet</h2>
        <p>Run a screening and this page fills in with risk ranks, feature coverage and the patents to review first.</p>
        <button className="btn btn-primary" onClick={() => onNavigate('screening')}>
          Go to screening <ArrowRight size={16} />
        </button>
      </div>
    );
  }

  const maxRank = Math.max(...stats.rankCounts, stats.noRank, 1);
  const maxCo = Math.max(...stats.cooccurrence.flat(), 1);
  const heatStep = (value) => Math.min(5, Math.max(1, Math.ceil((value / maxCo) * 5)));

  return (
    <div className="dashboard">
      {/* ===== HEADLINE ===== */}
      <section className="dash-hero blueprint">
        <div className="dash-hero-main">
          <span className="blueprint-eyebrow">Completed screening</span>
          <div className="dash-hero-figure">{screened.toLocaleString()}</div>
          <p className="dash-hero-caption">
            patents screened against {features.length} product features
            {stats.failed > 0 && ` · ${stats.failed} could not be analyzed`}
          </p>
        </div>
        <div className="dash-hero-tiles">
          <div className="glass dash-tile">
            <span className="dash-tile-label">High priority (Rank 1–2)</span>
            <span className="dash-tile-value">{stats.highPriority.toLocaleString()}</span>
            <span className="dash-tile-hint">{formatPercent(stats.highPriorityShare)} of patents</span>
          </div>
          <div className="glass dash-tile">
            <span className="dash-tile-label">Features matched per patent</span>
            <span className="dash-tile-value">{stats.averageFeatures.toFixed(1)}</span>
            <span className="dash-tile-hint">average, out of {features.length}</span>
          </div>
          <div className="glass dash-tile">
            <span className="dash-tile-label">Most common feature</span>
            <span className="dash-tile-value dash-tile-text" title={stats.mostCommon?.name}>{stats.mostCommon?.name}</span>
            <span className="dash-tile-hint">found in {formatPercent(stats.mostCommon?.share || 0)} of patents</span>
          </div>
        </div>
      </section>

      <div className="dash-grid">
        {/* ===== RISK DISTRIBUTION ===== */}
        <section className="card dash-card">
          <header className="dash-card-header">
            <h3>Risk distribution</h3>
            <p>Patents by how many of your features they contain</p>
          </header>
          <div className="hbar-list">
            {RANK_ROWS.map((row, i) => {
              const count = stats.rankCounts[i];
              return (
                <div key={row.key} className="hbar-row">
                  <span className="hbar-label">
                    <span className={`rank-swatch rank-swatch-${row.key}`} />
                    {row.label}
                    <span className="hbar-hint">{row.hint}</span>
                  </span>
                  <div
                    className="hbar-track"
                    {...bind({ value: `${count.toLocaleString()} patents · ${formatPercent(count / stats.total)}`, label: `${row.label}, ${row.detail}` })}
                  >
                    <div className={`hbar-fill rank-fill-${row.key}`} style={{ width: `${(count / maxRank) * 100}%` }} />
                    <span className="hbar-value">{count.toLocaleString()}</span>
                  </div>
                </div>
              );
            })}
            <div className="hbar-row">
              <span className="hbar-label">
                <span className="rank-swatch rank-swatch-none" />
                No rank
                <span className="hbar-hint">0</span>
              </span>
              <div
                className="hbar-track"
                {...bind({ value: `${stats.noRank.toLocaleString()} patents · ${formatPercent(stats.noRank / stats.total)}`, label: 'No rank, none of the features' })}
              >
                <div className="hbar-fill rank-fill-none" style={{ width: `${(stats.noRank / maxRank) * 100}%` }} />
                <span className="hbar-value">{stats.noRank.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </section>

        {/* ===== FEATURE COVERAGE ===== */}
        <section className="card dash-card">
          <header className="dash-card-header">
            <h3>Feature coverage</h3>
            <p>Share of patents where the AI found each feature</p>
          </header>
          <div className="hbar-list hbar-list-features">
            {stats.featureStats.map((feature) => (
              <div key={feature.name} className="hbar-row hbar-row-stacked">
                <span className="hbar-label" title={feature.name}>{feature.name}</span>
                <div
                  className="hbar-track"
                  {...bind({ value: `${formatPercent(feature.share)} · ${feature.count.toLocaleString()} patents`, label: feature.name })}
                >
                  <div className="hbar-fill feature-fill" style={{ width: `${feature.share * 100}%` }} />
                  <span className="hbar-value">{formatPercent(feature.share)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ===== CO-OCCURRENCE ===== */}
        <section className="card dash-card dash-card-wide">
          <header className="dash-card-header">
            <h3>Features found together</h3>
            <p>How many patents contain both features. Stronger color means more overlap; the striped diagonal is each feature on its own.</p>
          </header>
          <div className="heatmap" style={{ gridTemplateColumns: `minmax(120px, 1.4fr) repeat(${features.length}, minmax(56px, 1fr))` }}>
            <span />
            {features.map((name, j) => (
              <span key={name} className="heatmap-col" title={name}>F{j + 1}</span>
            ))}
            {features.map((rowName, i) => (
              <React.Fragment key={rowName}>
                <span className="heatmap-row" title={rowName}><b>F{i + 1}</b> {rowName}</span>
                {stats.cooccurrence[i].map((value, j) => (
                  <span
                    key={j}
                    className={`heatmap-cell heat-${heatStep(value)} ${i === j ? 'heatmap-diagonal' : ''}`}
                    {...bind({
                      value: `${value.toLocaleString()} patents · ${formatPercent(value / stats.total)}`,
                      label: i === j ? `${rowName}` : `${rowName} + ${features[j]}`
                    })}
                  >
                    {value.toLocaleString()}
                  </span>
                ))}
              </React.Fragment>
            ))}
          </div>
          <div className="heatmap-legend">
            <span>Fewer</span>
            {[1, 2, 3, 4, 5].map(step => <span key={step} className={`heatmap-legend-step heat-${step}`} />)}
            <span>More patents</span>
          </div>
        </section>

        {/* ===== TOP RISK ===== */}
        <section className="card dash-card dash-card-wide">
          <header className="dash-card-header dash-card-header-row">
            <div>
              <h3>Patents to review first</h3>
              <p>Highest rank first, then most features found with high confidence</p>
            </div>
            <button className="btn btn-secondary" onClick={() => onNavigate('screening')}>
              All results <ArrowRight size={16} />
            </button>
          </header>
          <div className="table-scroll">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>S.No.</th>
                  <th>Publication</th>
                  <th>Features found</th>
                  <th className="th-right">High confidence</th>
                </tr>
              </thead>
              <tbody>
                {stats.topRisk.map((result) => (
                  <tr key={result.claimNumber}>
                    <td><span className={`rank-badge rank-${result.rank}`}>{result.rank}</span></td>
                    <td className="td-number">{result.claimNumber}</td>
                    <td>
                      <a
                        href={`https://patents.google.com/patent/${result.publicationNumber}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="publication-link"
                      >
                        {result.publicationNumber} <ExternalLink size={12} />
                      </a>
                    </td>
                    <td>
                      <div className="feature-dots">
                        {features.map((name, j) => (
                          <span
                            key={name}
                            className={`feature-dot ${result[`feature_${j + 1}`] ? 'is-on' : ''}`}
                            title={`${name}: ${result[`feature_${j + 1}`] ? 'found' : 'not found'}`}
                          >
                            F{j + 1}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="td-right">{result.highConfidence} of {result.featureCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {tooltip}
    </div>
  );
};

export default Dashboard;
