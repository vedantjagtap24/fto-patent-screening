import React from 'react';
import { BarChart3, TrendingUp, Users, FileText, ArrowRight } from 'lucide-react';
import './Dashboard.css';

const Dashboard = ({ onNavigate }) => {
  const upcoming = [
    { icon: <TrendingUp size={18} />, title: 'Analytics & trends', description: 'Risk distribution across every analysis you run.' },
    { icon: <Users size={18} />, title: 'Team insights', description: 'See who reviewed which patents and what they decided.' },
    { icon: <FileText size={18} />, title: 'Report summaries', description: 'One-page FTO summaries ready to share with counsel.' }
  ];

  return (
    <div className="dashboard card">
      <div className="dashboard-empty">
        <span className="dashboard-icon">
          <BarChart3 size={24} />
        </span>
        <span className="dashboard-badge">Coming soon</span>
        <h2 className="dashboard-title">Your analysis dashboard</h2>
        <p className="dashboard-description">
          Charts and summaries from your screenings will appear here. In the meantime, run a screening to see ranked results.
        </p>
        <button className="btn btn-primary" onClick={() => onNavigate('screening')}>
          Go to screening
          <ArrowRight size={16} />
        </button>
      </div>

      <div className="dashboard-upcoming">
        {upcoming.map(item => (
          <div key={item.title} className="upcoming-item">
            <span className="upcoming-icon">{item.icon}</span>
            <div>
              <h3 className="upcoming-title">{item.title}</h3>
              <p className="upcoming-description">{item.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
