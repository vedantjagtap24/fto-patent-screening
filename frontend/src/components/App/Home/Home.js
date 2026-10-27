import React, { useMemo } from 'react';
import { ArrowRight, FileSpreadsheet, ListChecks, ShieldCheck } from 'lucide-react';
import useCountUp from '../../../hooks/useCountUp';
import Dashboard from '../Dashboard/Dashboard';
import { computeDashboardStats } from '../Dashboard/dashboardStats';
import './Home.css';

const steps = [
  {
    icon: <FileSpreadsheet size={20} />,
    title: 'Upload patent claims',
    description: 'An Excel file with S.No., Publication Number and Claims columns.'
  },
  {
    icon: <ListChecks size={20} />,
    title: 'Describe your product',
    description: 'List the key features of the product you want to clear.'
  },
  {
    icon: <ShieldCheck size={20} />,
    title: 'Review ranked risks',
    description: 'GPT-4.1 checks each claim against every feature; claims are ranked by how many match.'
  }
];

// The landing page after sign-in: what FTOlyzer does, the headline numbers from
// the latest run, and the charts from that run underneath
const Home = ({ onNavigate, analysisLocked, results = [], features = [], dataLoading }) => {
  const stats = useMemo(() => computeDashboardStats(results, features), [results, features]);
  const screened = useCountUp(stats.total);
  const highPriority = useCountUp(stats.highPriority);
  const hasRun = stats.total > 0;

  return (
    <div className="home">
      <section className="home-hero blueprint">
        <div className="hero-text">
          <span className="blueprint-eyebrow">Freedom to Operate screening</span>
          <h2 className="hero-title">Find the patents that could block your product, <em>before they do.</em></h2>
          <p className="hero-subtitle">
            FTOlyzer checks every patent claim against your product's features and ranks the claims
            that overlap most, so you know where to look first.
          </p>

          {hasRun && (
            <dl className="hero-stats">
              <div>
                <dt>{screened.toLocaleString()}</dt>
                <dd>patents screened</dd>
              </div>
              <div>
                <dt>{highPriority.toLocaleString()}</dt>
                <dd>high priority (Rank 1–2)</dd>
              </div>
              <div>
                <dt>{features.length}</dt>
                <dd>product features</dd>
              </div>
            </dl>
          )}

          <div className="hero-actions">
            <button className="btn btn-light btn-lg" onClick={() => onNavigate('screening')}>
              {analysisLocked || hasRun ? 'View all results' : 'Start screening'}
              <ArrowRight size={18} />
            </button>
          </div>
        </div>

        <ol className="hero-steps glass">
          {steps.map((step, index) => (
            <li key={step.title} className="hero-step">
              <span className="hero-step-icon">{step.icon}</span>
              <div>
                <span className="hero-step-number">Step {index + 1}</span>
                <h3 className="hero-step-title">{step.title}</h3>
                <p className="hero-step-description">{step.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <Dashboard onNavigate={onNavigate} results={results} features={features} dataLoading={dataLoading} />
    </div>
  );
};

export default Home;
