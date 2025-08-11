import React from 'react';
import { BarChart3, TrendingUp, Users, FileText } from 'lucide-react';
import './Dashboard.css';

const Dashboard = () => {
  return (
    <div className="module-content">
      <div className="section">
        <div className="dashboard-header">
          <h1 className="dashboard-title">Dashboard</h1>
          <p className="dashboard-subtitle">Patent analysis overview and insights</p>
        </div>

        <div className="dashboard-placeholder">
          <div className="placeholder-content">
            <BarChart3 size={64} className="placeholder-icon" />
            <h2 className="placeholder-title">Dashboard Coming Soon</h2>
            <p className="placeholder-description">
              This section will contain analytics, charts, and overview data from patent analysis.
            </p>
            
            <div className="feature-preview">
              <div className="feature-card">
                <TrendingUp size={24} />
                <span>Analytics & Trends</span>
              </div>
              <div className="feature-card">
                <Users size={24} />
                <span>Team Insights</span>
              </div>
              <div className="feature-card">
                <FileText size={24} />
                <span>Report Summaries</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;