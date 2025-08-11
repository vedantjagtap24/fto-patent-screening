import React from 'react';
import { Lightbulb, Target, Zap, Layers, Search, List } from 'lucide-react';
import './Home.css';

const Home = ({ onNavigate }) => {
  return (
    <div className="module-content">
      <div className="section">
        <div className="home-header">
          <h1 className="home-title">Welcome to FTOlyzer</h1>
          <p className="home-subtitle">AI-powered patent analysis platform for Freedom to Operate studies</p>
        </div>

        <div className="overview-grid">
          {/* Objective Card */}
          <div className="overview-card">
            <div className="card-icon">
              <Lightbulb size={32} className="icon-blue" />
            </div>
            <h3 className="card-title">Objective</h3>
            <p className="card-description">
              Conduct Freedom to Operate (FTO) analysis on a large volume
              of patent claims through an automated, AI-driven system.
            </p>
          </div>

          {/* Search Objective Card */}
          <div className="overview-card">
            <div className="card-icon">
              <Target size={32} className="icon-blue" />
            </div>
            <h3 className="card-title">Search Objective</h3>
            <p className="card-description">
              Detect potentially conflicting patents to mitigate infringement risks across critical technological areas.
            </p>
          </div>

          {/* Features Card */}
          <div className="overview-card">
            <div className="card-icon">
              <Zap size={32} className="icon-blue" />
            </div>
            <h3 className="card-title">Features</h3>
            <p className="card-description">
              Identifies and evaluates relevant features of the developed product against existing patents for FTO analysis.
            </p>
          </div>

          {/* Methodology Card */}
          <div className="overview-card">
            <div className="card-icon">
              <Layers size={32} className="icon-blue" />
            </div>
            <h3 className="card-title">Methodology</h3>
            <p className="card-description">
              Utilizes AI-based reasoning to evaluate and rank patents based on feature recognition and similarity metrics.
            </p>
          </div>

          {/* Search Strategy Card */}
          <div className="overview-card">
            <div className="card-icon">
              <Search size={32} className="icon-blue" />
            </div>
            <h3 className="card-title">Search Strategy</h3>
            <p className="card-description">
              Patent data is sourced from leading databases using a combination of keywords, classification codes, and jurisdictional filters.
            </p>
          </div>

          {/* Assumptions Card */}
          <div className="overview-card">
            <div className="card-icon">
              <List size={32} className="icon-blue" />
            </div>
            <h3 className="card-title">Assumptions</h3>
            <p className="card-description">
              While automated tools assist the process, legal conclusions and infringement assessments require qualified patent attorneys or legal experts for validation.
            </p>
          </div>
        </div>

        {/* Quick Actions Section */}
        <div className="quick-actions">
          <h2 className="actions-title">Get Started</h2>
          <div className="actions-grid">
            <button 
              className="action-card screening-action"
              onClick={() => onNavigate && onNavigate('screening')}
            >
              <Zap size={24} />
              <div className="action-content">
                <span className="action-label">Start Patent Screening</span>
                <p className="action-description">Upload and analyze patent claims</p>
              </div>
            </button>
            <button 
              className="action-card dashboard-action"
              onClick={() => onNavigate && onNavigate('dashboard')}
            >
              <Target size={24} />
              <div className="action-content">
                <span className="action-label">View Dashboard</span>
                <p className="action-description">See analytics and insights</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;