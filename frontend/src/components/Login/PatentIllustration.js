import React from 'react';

// Decorative patent sheet for the login panel: a "FIG. 1" drawing with
// reference numerals, claim lines, and one claim flagged as a feature match.
const PatentIllustration = () => (
  <svg className="patent-illustration" viewBox="0 0 440 300" preserveAspectRatio="xMinYMid meet" fill="none" aria-hidden="true">
    {/* Back sheet */}
    <g transform="rotate(-6 220 150)" opacity="0.5">
      <rect x="70" y="26" width="250" height="250" rx="10" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.35)" />
      <rect x="92" y="50" width="90" height="6" rx="3" fill="rgba(255,255,255,0.35)" />
      <rect x="92" y="66" width="140" height="4" rx="2" fill="rgba(255,255,255,0.22)" />
    </g>

    {/* Front sheet */}
    <g>
      <rect x="120" y="14" width="270" height="272" rx="10" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.6)" />

      {/* Header */}
      <text x="140" y="42" fill="#fff" fontSize="11" fontWeight="600" fontFamily="ui-monospace, Menlo, monospace" letterSpacing="0.5">US 11,678,945 B2</text>
      <rect x="306" y="32" width="64" height="14" rx="7" fill="rgba(255,255,255,0.18)" />
      <text x="338" y="42" fill="#fff" fontSize="8" fontWeight="600" textAnchor="middle" fontFamily="Inter, sans-serif">PATENT</text>
      <line x1="140" y1="54" x2="370" y2="54" stroke="rgba(255,255,255,0.3)" />

      {/* FIG. 1: instrument drawing with reference numerals */}
      <g stroke="#fff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="192" cy="112" r="26" opacity="0.9" />
        <circle cx="192" cy="112" r="10" opacity="0.9" />
        <path d="M218 112 H282 L300 98 M282 112 L300 126" opacity="0.9" />
        <path d="M166 112 H150 V146 H176" opacity="0.9" />
        <rect x="176" y="138" width="34" height="16" rx="3" opacity="0.9" />
      </g>
      <g stroke="rgba(255,255,255,0.55)" strokeWidth="1" strokeDasharray="2 3">
        <line x1="206" y1="92" x2="236" y2="72" />
        <line x1="270" y1="112" x2="300" y2="146" />
        <line x1="193" y1="154" x2="226" y2="170" />
      </g>
      <g fill="#fff" fontSize="9" fontFamily="ui-monospace, Menlo, monospace">
        <text x="240" y="72">102</text>
        <text x="304" y="152">104</text>
        <text x="230" y="174">106</text>
      </g>
      <text x="318" y="82" fill="rgba(255,255,255,0.75)" fontSize="9" fontWeight="600" fontFamily="Inter, sans-serif" letterSpacing="1">FIG. 1</text>

      {/* Claim lines */}
      <text x="140" y="200" fill="rgba(255,255,255,0.75)" fontSize="8" fontWeight="600" fontFamily="Inter, sans-serif" letterSpacing="1">CLAIMS</text>
      <rect x="140" y="210" width="220" height="5" rx="2.5" fill="rgba(255,255,255,0.3)" />
      <rect x="134" y="222" width="242" height="17" rx="4" fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.75)" />
      <rect x="140" y="228" width="180" height="5" rx="2.5" fill="#fff" />
      <rect x="140" y="246" width="200" height="5" rx="2.5" fill="rgba(255,255,255,0.3)" />
      <rect x="140" y="260" width="150" height="5" rx="2.5" fill="rgba(255,255,255,0.3)" />
    </g>

    {/* Feature-match callout */}
    <g>
      <rect x="18" y="206" width="132" height="46" rx="10" fill="#fff" />
      <circle cx="38" cy="229" r="9" fill="#e8f6f0" />
      <path d="M34 229 L37 232 L42 226" stroke="#12805c" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <text x="54" y="225" fill="#101828" fontSize="10" fontWeight="600" fontFamily="Inter, sans-serif">Feature match</text>
      <text x="54" y="239" fill="#c4320a" fontSize="9" fontWeight="600" fontFamily="Inter, sans-serif">Rank 1 · 4/4</text>
    </g>
  </svg>
);

export default PatentIllustration;
