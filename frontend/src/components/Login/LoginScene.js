import React, { useRef } from 'react';
import { Check, X } from 'lucide-react';
import useCountUp from '../../hooks/useCountUp';
import { rankFor } from '../App/Screening/resultsFilter';

// Shown until the live summary loads, or when there is no completed run yet
const SAMPLE_FEATURES = ['Feature one', 'Feature two', 'Feature three', 'Feature four'];

// Animated hero for the login page: a patent sheet being scanned while feature
// checks and a rank verdict appear beside it. Leans gently toward the pointer.
const LoginScene = ({ summary }) => {
  const sceneRef = useRef(null);
  const live = summary?.available;
  const screened = useCountUp(live ? summary.patents : 0);

  // The scene checks up to four of the run's real features: all match but the
  // last, so the verdict shows a rank below the top one
  const featureNames = (live && summary.features.length ? summary.features : SAMPLE_FEATURES).slice(0, 4);
  const matched = Math.max(1, featureNames.length - 1);
  const chips = featureNames.map((label, i) => ({ label, match: i < matched }));
  const verdictRank = rankFor(matched, featureNames.length);

  const handlePointerMove = (e) => {
    const el = sceneRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--px', ((e.clientX - rect.left) / rect.width - 0.5).toFixed(3));
    el.style.setProperty('--py', ((e.clientY - rect.top) / rect.height - 0.5).toFixed(3));
  };

  return (
    <div className="scene" ref={sceneRef} onPointerMove={handlePointerMove} aria-hidden="true">
      <div className="scene-stage">
        <div className="scene-sheet scene-sheet-back" />
        <div className="scene-sheet scene-sheet-mid" />

        <svg className="scene-sheet scene-sheet-front" viewBox="0 0 300 380">
          <defs>
            <linearGradient id="scan-beam" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#7dd3fc" stopOpacity="0" />
              <stop offset="0.85" stopColor="#7dd3fc" stopOpacity="0.45" />
              <stop offset="1" stopColor="#e0f2fe" stopOpacity="0.95" />
            </linearGradient>
            <clipPath id="sheet-clip">
              <rect x="0" y="0" width="300" height="380" rx="14" />
            </clipPath>
          </defs>

          <rect x="0.5" y="0.5" width="299" height="379" rx="14" className="sheet-paper" />

          <text x="24" y="38" className="sheet-number">US 11,678,945 B2</text>
          <rect x="214" y="26" width="62" height="16" rx="8" className="sheet-tag" />
          <text x="245" y="37.5" className="sheet-tag-text" textAnchor="middle">Patent</text>
          <line x1="24" y1="54" x2="276" y2="54" className="sheet-rule" />

          {/* FIG. 1 drawing with reference numerals */}
          <g className="sheet-drawing">
            <circle cx="92" cy="118" r="30" />
            <circle cx="92" cy="118" r="11" />
            <path d="M122 118 H196 L216 102 M196 118 L216 134" />
            <path d="M62 118 H46 V156 H76" />
            <rect x="76" y="148" width="38" height="18" rx="3" />
          </g>
          <g className="sheet-leaders">
            <line x1="108" y1="94" x2="140" y2="74" />
            <line x1="182" y1="118" x2="216" y2="156" />
            <line x1="95" y1="166" x2="128" y2="184" />
          </g>
          <g className="sheet-refs">
            <text x="144" y="74">102</text>
            <text x="220" y="164">104</text>
            <text x="132" y="190">106</text>
          </g>
          <text x="230" y="84" className="sheet-fig">FIG. 1</text>

          <text x="24" y="226" className="sheet-fig">Claims</text>
          {[0, 1, 2, 3, 4].map(i => (
            <rect
              key={i}
              x="24"
              y={240 + i * 24}
              width={[232, 200, 220, 170, 210][i]}
              height="8"
              rx="4"
              className={`sheet-line sheet-line-${i}`}
            />
          ))}

          <g clipPath="url(#sheet-clip)">
            <rect className="scan-beam" x="0" y="-90" width="300" height="90" fill="url(#scan-beam)" />
          </g>
        </svg>

        <div className="scene-checks">
        <ul className="scene-chips">
          {chips.map((feature, i) => (
            <li key={feature.label} className={`scene-chip scene-chip-${i} ${feature.match ? 'is-match' : 'is-miss'}`}>
              <span className="scene-chip-icon">{feature.match ? <Check size={13} /> : <X size={13} />}</span>
              <span className="scene-chip-label">{feature.label}</span>
            </li>
          ))}
        </ul>

        {/* The verdict follows the checks, so long feature names push it down instead of overlapping */}
        <div className="scene-verdict">
          <span className="scene-verdict-rank">Rank {verdictRank}</span>
          <span className="scene-verdict-text">{matched} of {featureNames.length} features matched</span>
        </div>
        </div>

        {live && (
          <div className="scene-counter">
            <span className="scene-counter-value">{screened.toLocaleString()}</span>
            <span className="scene-counter-label">patents screened</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginScene;
