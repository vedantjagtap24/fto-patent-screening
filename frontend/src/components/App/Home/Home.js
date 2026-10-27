import React, { useState, useEffect } from 'react';
import { Lightbulb, Target, Zap, Layers, Search, List, X, ArrowRight, FileSpreadsheet, ListChecks, ShieldCheck, ChevronRight } from 'lucide-react';
import './Home.css';

const Home = ({ onNavigate }) => {
  const [activeModal, setActiveModal] = useState(null);

  const modalData = {
    objective: {
      title: "Objective",
      icon: <Lightbulb size={20} />,
      content: `
        <h3>Freedom to Operate Analysis</h3>
        <p>Our comprehensive FTO analysis provides a systematic approach to patent landscape evaluation. This process involves:</p>
        <ul>
          <li><strong>Large-scale Patent Processing:</strong> Automated analysis of thousands of patent documents simultaneously</li>
          <li><strong>AI-Driven Classification:</strong> Machine learning algorithms categorize and prioritize patent claims based on relevance</li>
          <li><strong>Risk Assessment:</strong> Quantitative scoring of potential infringement risks across different technology areas</li>
          <li><strong>Patent Conflict Identification:</strong> Automated identification of patents that pose potential infringement risks based on claim comparison and technical feature matching</li>
        </ul>
        <p>The system is designed to handle complex patent landscapes efficiently, reducing the time from months to days for comprehensive FTO studies.</p>
      `
    },
    searchObjective: {
      title: "Search Objective",
      icon: <Target size={20} />,
      content: `
        <h3>Comprehensive Patent Conflict Detection</h3>
        <p>Our search methodology focuses on identifying patents that could pose infringement risks:</p>
        <ul>
          <li><strong>Technology Mapping:</strong> Systematic mapping of your product features against existing patent claims</li>
          <li><strong>Jurisdictional Coverage:</strong> Analysis across multiple patent offices including USPTO, EPO, JPO, and others</li>
          <li><strong>Prior Art Discovery:</strong> Identification of relevant prior art that could affect patent validity</li>
        </ul>
        <p>The system prioritizes patents based on claim strength, enforceability, and commercial relevance to your specific use case.</p>
      `
    },
    features: {
      title: "Features",
      icon: <Zap size={20} />,
      content: `
        <h3>Advanced Feature Recognition System</h3>
        <p>Our platform employs sophisticated feature extraction and comparison algorithms:</p>
        <ul>
          <li><strong>Natural Language Processing:</strong> Advanced NLP techniques to understand patent claim language and technical descriptions</li>
          <li><strong>Feature Extraction:</strong> Automated identification of key technical features from your product specifications</li>
          <li><strong>Visual Patent Analysis:</strong> Processing of patent diagrams and figures for comprehensive comparison</li>
        </ul>
        <p>The feature recognition system continuously learns and improves its accuracy through machine learning feedback loops.</p>
      `
    },
    methodology: {
      title: "Methodology",
      icon: <Layers size={20} />,
      content: `
        <h3>AI-Based Patent Evaluation Framework</h3>
        <p>Our methodology combines multiple AI techniques for comprehensive patent analysis:</p>
        <ul>
          <li><strong>Multi-Stage Filtering:</strong> Progressive filtering from broad searches to highly relevant results</li>
          <li><strong>Similarity Scoring:</strong> Advanced algorithms calculate similarity scores based on technical features, claims, and descriptions</li>
          <li><strong>Risk Stratification:</strong> Patents are categorized into high, medium, and low risk categories</li>
          <li><strong>Validity Assessment:</strong> AI-assisted evaluation of patent strength and potential invalidity arguments</li>
        </ul>
        <p>The methodology is continuously validated against expert legal opinions to ensure accuracy and reliability.</p>
      `
    },
    searchStrategy: {
      title: "Search Strategy",
      icon: <Search size={20} />,
      content: `
        <h3>Multi-Database Patent Intelligence</h3>
        <p>Our search strategy leverages multiple data sources and search techniques:</p>
        <ul>
          <li><strong>Database Coverage:</strong> Multi-Database Patent Intelligence (Beta Phase)</li>
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
      icon: <List size={20} />,
      content: `
        <h3>Legal and Technical Limitations</h3>
        <p>Important considerations and limitations of automated patent analysis:</p>
        <ul>
          <li><strong>Legal Expertise Required:</strong> Final infringement determinations must be made by qualified patent attorneys</li>
          <li><strong>Claim Interpretation:</strong> Patent claim interpretation may vary and requires legal analysis</li>
          <li><strong>Jurisdictional Variations:</strong> Patent laws and enforcement practices differ across jurisdictions</li>
          <li><strong>Data Currency:</strong> Patent databases may have delays in updating; recent applications might not be captured</li>
          <li><strong>False Positives:</strong> Automated systems may flag patents that upon legal review pose minimal risk</li>
        </ul>
        <p><strong>Disclaimer:</strong> This tool provides preliminary analysis for informational purposes. All results should be reviewed by qualified patent counsel before making business decisions.</p>
      `
    }
  };

  const openModal = (cardType) => setActiveModal(cardType);
  const closeModal = () => setActiveModal(null);

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

  const overviewCards = [
    {
      id: 'objective',
      icon: <Lightbulb size={20} />,
      title: 'Objective',
      description: 'Conduct Freedom to Operate (FTO) analysis on a large volume of patent claims through an automated, AI-driven system.'
    },
    {
      id: 'searchObjective',
      icon: <Target size={20} />,
      title: 'Search Objective',
      description: 'Detect potentially conflicting patents to mitigate infringement risks across critical technological areas.'
    },
    {
      id: 'features',
      icon: <Zap size={20} />,
      title: 'Features',
      description: 'Identifies and evaluates relevant features of the developed product against existing patents for FTO analysis.'
    },
    {
      id: 'methodology',
      icon: <Layers size={20} />,
      title: 'Methodology',
      description: 'Utilizes AI-based reasoning to evaluate and rank patents based on feature recognition and similarity metrics.'
    },
    {
      id: 'searchStrategy',
      icon: <Search size={20} />,
      title: 'Search Strategy',
      description: 'Patent data is sourced from leading databases using a combination of keywords, classification codes, and jurisdictional filters.'
    },
    {
      id: 'assumptions',
      icon: <List size={20} />,
      title: 'Assumptions',
      description: 'While automated tools assist the process, legal conclusions and infringement assessments require qualified patent attorneys or legal experts for validation.'
    }
  ];

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
      description: 'Each claim is checked against every feature and ranked by overlap.'
    }
  ];

  return (
    <>
      <div className="home">
        <section className="home-hero card">
          <div className="hero-text">
            <span className="hero-eyebrow">Freedom to Operate screening</span>
            <h2 className="hero-title">Find the patents that could block your product, before they do.</h2>
            <p className="hero-subtitle">
              FTOlyzer reads every patent claim, checks it against your product's features with AI,
              and ranks the claims that overlap most so your team knows where to look first.
            </p>
            <div className="hero-actions">
              <button className="btn btn-primary btn-lg" onClick={() => onNavigate('screening')}>
                Start screening
                <ArrowRight size={18} />
              </button>
              <button className="btn btn-secondary btn-lg" onClick={() => openModal('methodology')}>
                How ranking works
              </button>
            </div>
          </div>

          <ol className="hero-steps">
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

        <section>
          <div className="home-section-header">
            <h2 className="home-section-title">About the analysis</h2>
            <p className="home-section-subtitle">Select a topic to read more.</p>
          </div>

          <div className="overview-grid">
            {overviewCards.map((card) => (
              <button
                key={card.id}
                className="overview-card card"
                onClick={() => openModal(card.id)}
              >
                <div className="overview-card-top">
                  <span className="card-icon">{card.icon}</span>
                  <ChevronRight size={18} className="card-chevron" />
                </div>
                <h3 className="card-title">{card.title}</h3>
                <p className="card-description">{card.description}</p>
              </button>
            ))}
          </div>
        </section>
      </div>

      {activeModal && (
        <div className="home-modal-overlay" onClick={closeModal}>
          <div className="home-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="home-modal-header">
              <div className="home-modal-title-section">
                <span className="card-icon">{modalData[activeModal].icon}</span>
                <h2 className="home-modal-title">{modalData[activeModal].title}</h2>
              </div>
              <button className="icon-btn" onClick={closeModal}>
                <X size={20} />
              </button>
            </div>
            <div className="home-modal-body">
              <div dangerouslySetInnerHTML={{ __html: modalData[activeModal].content }} />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Home;
