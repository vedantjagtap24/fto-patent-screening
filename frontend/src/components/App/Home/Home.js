import React, { useState } from 'react';
import { Lightbulb, Target, Zap, Layers, Search, List, X } from 'lucide-react';

const Home = ({ onNavigate }) => {
  const [activeModal, setActiveModal] = useState(null);

  // Test function to make sure clicks work
  const testClick = () => {
    alert('Click is working!');
  };

  const openModal = (cardType) => {
    console.log('Opening modal for:', cardType); // Debug log
    setActiveModal(cardType);
  };

  const closeModal = () => {
    console.log('Closing modal'); // Debug log
    setActiveModal(null);
  };

  // Simple modal data for testing
  const getModalContent = (type) => {
    switch(type) {
      case 'objective':
        return {
          title: "Objective Details",
          content: "This is detailed information about the Objective card. The modal is working!"
        };
      case 'searchObjective':
        return {
          title: "Search Objective Details", 
          content: "This is detailed information about the Search Objective card."
        };
      default:
        return {
          title: "Modal Test",
          content: "Modal is working correctly!"
        };
    }
  };

  return (
    <>
      {/* Debug button to test state */}
      <div style={{padding: '1rem', background: '#f0f0f0', margin: '1rem'}}>
        <p>Debug: Active modal is: {activeModal || 'none'}</p>
        <button onClick={testClick} style={{marginRight: '1rem', padding: '0.5rem'}}>
          Test Click (Should show alert)
        </button>
        <button onClick={() => openModal('test')} style={{padding: '0.5rem'}}>
          Test Modal Open
        </button>
      </div>

      <div className="module-content">
        <div className="section">
          <div className="home-header">
            <h1 className="home-title">Welcome to FTOlyzer</h1>
            <p className="home-subtitle">AI-powered patent analysis platform for Freedom to Operate studies</p>
          </div>

          <div className="overview-grid">
            {/* Test with very simple onClick first */}
            <div 
              className="overview-card clickable-card" 
              onClick={() => {
                console.log('Objective card clicked!');
                openModal('objective');
              }}
              style={{border: '2px solid red'}} // Make it obvious which card this is
            >
              <div className="card-icon">
                <Lightbulb size={32} className="icon-blue" />
              </div>
              <h3 className="card-title">Objective (TEST)</h3>
              <p className="card-description">
                Click me to test the modal! This card has a red border for testing.
              </p>
              <div className="click-indicator">Click for more details</div>
            </div>

            {/* Keep other cards simple for now */}
            <div className="overview-card">
              <div className="card-icon">
                <Target size={32} className="icon-blue" />
              </div>
              <h3 className="card-title">Search Objective</h3>
              <p className="card-description">
                Detect potentially conflicting patents to mitigate infringement risks across critical technological areas.
              </p>
            </div>

            <div className="overview-card">
              <div className="card-icon">
                <Zap size={32} className="icon-blue" />
              </div>
              <h3 className="card-title">Features</h3>
              <p className="card-description">
                Identifies and evaluates relevant features of the developed product against existing patents for FTO analysis.
              </p>
            </div>

            <div className="overview-card">
              <div className="card-icon">
                <Layers size={32} className="icon-blue" />
              </div>
              <h3 className="card-title">Methodology</h3>
              <p className="card-description">
                Utilizes AI-based reasoning to evaluate and rank patents based on feature recognition and similarity metrics.
              </p>
            </div>

            <div className="overview-card">
              <div className="card-icon">
                <Search size={32} className="icon-blue" />
              </div>
              <h3 className="card-title">Search Strategy</h3>
              <p className="card-description">
                Patent data is sourced from leading databases using a combination of keywords, classification codes, and jurisdictional filters.
              </p>
            </div>

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

      {/* Simple Modal for Testing */}
      {activeModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
          }}
          onClick={closeModal}
        >
          <div 
            style={{
              background: 'white',
              borderRadius: '1rem',
              padding: '2rem',
              maxWidth: '600px',
              margin: '1rem'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem'}}>
              <h2>{getModalContent(activeModal).title}</h2>
              <button 
                onClick={closeModal}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer'
                }}
              >
                ×
              </button>
            </div>
            <p>{getModalContent(activeModal).content}</p>
            <p style={{fontSize: '0.9rem', color: '#666', marginTop: '1rem'}}>
              Debug: Modal state is "{activeModal}"
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default Home;