import React, { useState } from 'react';
import { Lightbulb, Target, Zap, Layers, Search, List, X } from 'lucide-react';

const Home = ({ onNavigate }) => {
  const [activeModal, setActiveModal] = useState(null);

  // Modal content data
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

  const openModal = (cardType) => {
    setActiveModal(cardType);
  };

  const closeModal = () => {
    setActiveModal(null);
  };

  // Handle escape key to close modal
  React.useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        closeModal();
      }
    };

    if (activeModal) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [activeModal]);

  return (
    <>
      <div className="module-content">
        <div className="section">
          <div className="home-header">
            <h1 className="home-title">Welcome to FTOlyzer</h1>
            <p className="home-subtitle">AI-powered patent analysis platform for Freedom to Operate studies</p>
          </div>

          <div className="overview-grid">
            {/* Objective Card */}
            <div className="overview-card clickable-card" onClick={() => openModal('objective')}>
              <div className="card-icon">
                <Lightbulb size={32} className="icon-blue" />
              </div>
              <h3 className="card-title">Objective</h3>
              <p className="card-description">
                Conduct Freedom to Operate (FTO) analysis on a large volume
                of patent claims through an automated, AI-driven system.
              </p>
              <div className="click-indicator">Click for more details</div>
            </div>

            {/* Search Objective Card */}
            <div className="overview-card clickable-card" onClick={() => openModal('searchObjective')}>
              <div className="card-icon">
                <Target size={32} className="icon-blue" />
              </div>
              <h3 className="card-title">Search Objective</h3>
              <p className="card-description">
                Detect potentially conflicting patents to mitigate infringement risks across critical technological areas.
              </p>
              <div className="click-indicator">Click for more details</div>
            </div>

            {/* Features Card */}
            <div className="overview-card clickable-card" onClick={() => openModal('features')}>
              <div className="card-icon">
                <Zap size={32} className="icon-blue" />
              </div>
              <h3 className="card-title">Features</h3>
              <p className="card-description">
                Identifies and evaluates relevant features of the developed product against existing patents for FTO analysis.
              </p>
              <div className="click-indicator">Click for more details</div>
            </div>

            {/* Methodology Card */}
            <div className="overview-card clickable-card" onClick={() => openModal('methodology')}>
              <div className="card-icon">
                <Layers size={32} className="icon-blue" />
              </div>
              <h3 className="card-title">Methodology</h3>
              <p className="card-description">
                Utilizes AI-based reasoning to evaluate and rank patents based on feature recognition and similarity metrics.
              </p>
              <div className="click-indicator">Click for more details</div>
            </div>

            {/* Search Strategy Card */}
            <div className="overview-card clickable-card" onClick={() => openModal('searchStrategy')}>
              <div className="card-icon">
                <Search size={32} className="icon-blue" />
              </div>
              <h3 className="card-title">Search Strategy</h3>
              <p className="card-description">
                Patent data is sourced from leading databases using a combination of keywords, classification codes, and jurisdictional filters.
              </p>
              <div className="click-indicator">Click for more details</div>
            </div>

            {/* Assumptions Card */}
            <div className="overview-card clickable-card" onClick={() => openModal('assumptions')}>
              <div className="card-icon">
                <List size={32} className="icon-blue" />
              </div>
              <h3 className="card-title">Assumptions</h3>
              <p className="card-description">
                While automated tools assist the process, legal conclusions and infringement assessments require qualified patent attorneys or legal experts for validation.
              </p>
              <div className="click-indicator">Click for more details</div>
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

      {/* Modal Overlay */}
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