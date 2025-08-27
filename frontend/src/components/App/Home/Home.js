import React, { useState, useEffect } from 'react';
import { Lightbulb, Target, Zap, Layers, Search, List, X, ArrowRight, TrendingUp, FileText, Users } from 'lucide-react';
import './Home.css';

const Home = ({ onNavigate }) => {
  const [activeModal, setActiveModal] = useState(null);

  // Modal content data (consolidated)
  const modalData = {
    objective: {
      title: "Objective",
      icon: <Lightbulb size={32} className="icon-blue" />,
      content: `
        <h3>Freedom to Operate Analysis</h3>
        <p>Our comprehensive FTO analysis provides a systematic approach to patent landscape evaluation. This process involves:</p>
        <ul>
          <li><strong>Large-scale Patent Processing:</strong> Automated analysis of thousands of patent documents simultaneously</li>
          <li><strong>AI-Driven Classification:</strong> Machine learning algorithms categorize and prioritize patent claims based on relevance</li>
          <li><strong>Risk Assessment:</strong> Quantitative scoring of potential infringement risks across different technology areas</li>
          <li><strong>Competitive Intelligence:</strong> Identification of key players and their patent portfolios in your technology space</li>
        </ul>
        <p>The system is designed to handle complex patent landscapes efficiently, reducing the time from months to days for comprehensive FTO studies.</p>
      `
    },
    searchObjective: {
      title: "Search Objective",
      icon: <Target size={32} className="icon-blue" />,
      content: `
        <h3>Comprehensive Patent Conflict Detection</h3>
        <p>Our search methodology focuses on identifying patents that could pose infringement risks:</p>
        <ul>
          <li><strong>Technology Mapping:</strong> Systematic mapping of your product features against existing patent claims</li>
          <li><strong>Jurisdictional Coverage:</strong> Analysis across multiple patent offices including USPTO, EPO, JPO, and others</li>
          <li><strong>Prior Art Discovery:</strong> Identification of relevant prior art that could affect patent validity</li>
          <li><strong>White Space Analysis:</strong> Discovery of areas with limited patent coverage for future innovation</li>
        </ul>
        <p>The system prioritizes patents based on claim strength, enforceability, and commercial relevance to your specific use case.</p>
      `
    },
    features: {
      title: "Features",
      icon: <Zap size={32} className="icon-blue" />,
      content: `
        <h3>Advanced Feature Recognition System</h3>
        <p>Our platform employs sophisticated feature extraction and comparison algorithms:</p>
        <ul>
          <li><strong>Natural Language Processing:</strong> Advanced NLP techniques to understand patent claim language and technical descriptions</li>
          <li><strong>Feature Extraction:</strong> Automated identification of key technical features from your product specifications</li>
          <li><strong>Semantic Matching:</strong> AI-powered semantic analysis to find conceptually similar patents beyond keyword matching</li>
          <li><strong>Visual Patent Analysis:</strong> Processing of patent diagrams and figures for comprehensive comparison</li>
          <li><strong>Technology Taxonomy:</strong> Classification using international patent classification systems (IPC, CPC)</li>
        </ul>
        <p>The feature recognition system continuously learns and improves its accuracy through machine learning feedback loops.</p>
      `
    },
    methodology: {
      title: "Methodology",
      icon: <Layers size={32} className="icon-blue" />,
      content: `
        <h3>AI-Based Patent Evaluation Framework</h3>
        <p>Our methodology combines multiple AI techniques for comprehensive patent analysis:</p>
        <ul>
          <li><strong>Multi-Stage Filtering:</strong> Progressive filtering from broad searches to highly relevant results</li>
          <li><strong>Similarity Scoring:</strong> Advanced algorithms calculate similarity scores based on technical features, claims, and descriptions</li>
          <li><strong>Risk Stratification:</strong> Patents are categorized into high, medium, and low risk categories</li>
          <li><strong>Claim Chart Generation:</strong> Automated generation of preliminary claim charts for high-risk patents</li>
          <li><strong>Validity Assessment:</strong> AI-assisted evaluation of patent strength and potential invalidity arguments</li>
        </ul>
        <p>The methodology is continuously validated against expert legal opinions to ensure accuracy and reliability.</p>
      `
    },
    searchStrategy: {
      title: "Search Strategy",
      icon: <Search size={32} className="icon-blue" />,
      content: `
        <h3>Multi-Database Patent Intelligence</h3>
        <p>Our search strategy leverages multiple data sources and search techniques:</p>
        <ul>
          <li><strong>Database Coverage:</strong> Integration with major patent databases including Google Patents, USPTO, Espacenet, WIPO, and commercial databases</li>
          <li><strong>Search Optimization:</strong> Combination of keyword searches, classification code searches, and inventor/assignee searches</li>
          <li><strong>Boolean Logic:</strong> Advanced boolean search strategies with proximity operators and field-specific searches</li>
          <li><strong>Citation Analysis:</strong> Forward and backward citation analysis to discover related patents</li>
          <li><strong>Real-time Updates:</strong> Continuous monitoring for newly published patents in relevant technology areas</li>
        </ul>
        <p>Search strategies are customized based on technology domain and geographic markets of interest.</p>
      `
    },
    assumptions: {
      title: "Assumptions",
      icon: <List size={32} className="icon-blue" />,
      content: `
        <h3>Legal and Technical Limitations</h3>
        <p>Important considerations and limitations of automated patent analysis:</p>
        <ul>
          <li><strong>Legal Expertise Required:</strong> Final infringement determinations must be made by qualified patent attorneys</li>
          <li><strong>Claim Construction:</strong> Patent claim interpretation may vary and requires legal analysis</li>
          <li><strong>Jurisdictional Variations:</strong> Patent laws and enforcement practices differ across jurisdictions</li>
          <li><strong>Data Currency:</strong> Patent databases may have delays in updating; recent applications might not be captured</li>
          <li><strong>False Positives:</strong> Automated systems may flag patents that upon legal review pose minimal risk</li>
        </ul>
        <p><strong>Disclaimer:</strong> This tool provides preliminary analysis for informational purposes. All results should be reviewed by qualified patent counsel before making business decisions.</p>
      `
    }
  };

  // Modal handlers (consolidated)
  const openModal = (cardType) => setActiveModal(cardType);
  const closeModal = () => setActiveModal(null);

  // Handle escape key and body scroll
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') closeModal();
    };

    if (activeModal) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [activeModal]);

  // Overview cards data
  const overviewCards = [
    {
      id: 'objective',
      icon: <Lightbulb size={32} className="icon-blue" />,
      title: 'Objective',
      description: 'Conduct Freedom to Operate (FTO) analysis on a large volume of patent claims through an automated, AI-driven system.'
    },
    {
      id: 'searchObjective',
      icon: <Target size={32} className="icon-blue" />,
      title: 'Search Objective',
      description: 'Detect potentially conflicting patents to mitigate infringement risks across critical technological areas.'
    },
    {
      id: 'features',
      icon: <Zap size={32} className="icon-blue" />,
      title: 'Features',
      description: 'Identifies and evaluates relevant features of the developed product against existing patents for FTO analysis.'
    },
    {
      id: 'methodology',
      icon: <Layers size={32} className="icon-blue" />,
      title: 'Methodology',
      description: 'Utilizes AI-based reasoning to evaluate and rank patents based on feature recognition and similarity metrics.'
    },
    {
      id: 'searchStrategy',
      icon: <Search size={32} className="icon-blue" />,
      title: 'Search Strategy',
      description: 'Patent data is sourced from leading databases using a combination of keywords, classification codes, and jurisdictional filters.'
    },
    {
      id: 'assumptions',
      icon: <List size={32} className="icon-blue" />,
      title: 'Assumptions',
      description: 'While automated tools assist the process, legal conclusions and infringement assessments require qualified patent attorneys or legal experts for validation.'
    }
  ];

  // Action cards data
  const actionCards = [
    {
      id: 'screening',
      icon: <Zap size={24} />,
      label: 'Start Patent Screening',
      description: 'Upload and analyze patent claims',
      className: 'screening-action'
    },
    {
      id: 'dashboard',
      icon: <Target size={24} />,
      label: 'View Dashboard',
      description: 'See analytics and insights',
      className: 'dashboard-action'
    }
  ];

  // Metrics data for admin dashboard feel
  const metrics = [
    { value: '2,845', label: 'Patents Analyzed', icon: <FileText size={20} />, color: '#2563eb' },
    { value: '156', label: 'Active Projects', icon: <TrendingUp size={20} />, color: '#059669' },
    { value: '89%', label: 'Success Rate', icon: <Target size={20} />, color: '#7c3aed' },
    { value: '24', label: 'Team Members', icon: <Users size={20} />, color: '#dc2626' }
  ];

  return (
    <>
      <div className="admin-layout">
        {/* Header */}
        <div className="admin-header">
          <h1 className="admin-title">Welcome to FTOlyzer</h1>
          <p className="admin-subtitle">AI-powered patent analysis platform for Freedom to Operate studies</p>
        </div>

        {/* Metrics Bar */}
        <div className="admin-metrics-bar">
          {metrics.map((metric, index) => (
            <div key={index} className="metric-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: metric.color }}>{metric.icon}</span>
                <div className="metric-value" style={{ color: metric.color }}>
                  {metric.value}
                </div>
              </div>
              <div className="metric-label">{metric.label}</div>
            </div>
          ))}
        </div>

        {/* Main Content */}
        <div className="admin-content">
          {/* Quick Actions */}
          <div className="admin-section">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h2 className="section-title">Quick Actions</h2>
              <button className="view-all-btn">
                View All <ArrowRight size={16} />
              </button>
            </div>
            <div className="quick-actions-grid">
              {actionCards.map((action) => (
                <button 
                  key={action.id}
                  className={`action-card admin-action ${action.className}`}
                  onClick={() => onNavigate && onNavigate(action.id)}
                >
                  <div className="action-icon">{action.icon}</div>
                  <div className="action-content">
                    <span className="action-label">{action.label}</span>
                    <p className="action-description">{action.description}</p>
                  </div>
                  <ArrowRight size={20} className="action-arrow" />
                </button>
              ))}
            </div>
          </div>

          {/* Overview Grid */}
          <div className="admin-section">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h2 className="section-title">Platform Overview</h2>
            </div>
            <div className="overview-grid admin-overview">
              {overviewCards.map((card) => (
                <div 
                  key={card.id}
                  className="overview-card admin-card clickable-card" 
                  onClick={() => openModal(card.id)}
                >
                  <div className="card-header">
                    <div className="card-icon">{card.icon}</div>
                    <h3 className="card-title">{card.title}</h3>
                  </div>
                  <p className="card-description">{card.description}</p>
                  <div className="card-footer">
                    <span className="learn-more">Learn more <ArrowRight size={16} /></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
      {activeModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-section">
                {modalData[activeModal].icon}
                <h2 className="modal-title">{modalData[activeModal].title}</h2>
              </div>
              <button className="modal-close" onClick={closeModal}>
                <X size={24} />
              </button>
            </div>
            <div className="modal-body">
              <div dangerouslySetInnerHTML={{ __html: modalData[activeModal].content }} />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Home;