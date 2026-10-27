// Filtering and export for the results table. Kept free of React so the table,
// the filter counts and the Excel export all use exactly the same rules.

// Rank filter values: null = Rank 1 & 2 (default view), 'all', 1-4, or 'none' (0 features)
export const RANK_ALL = 'all';
export const RANK_NONE = 'none';

const featureKeys = (features) => features.map((_, index) => `feature_${index + 1}`);

export const rankFor = (featureCount, totalFeatures) => {
  if (featureCount === 0) return null;
  if (featureCount === totalFeatures) return 1;
  if (featureCount >= Math.ceil(totalFeatures * 0.75)) return 2;
  if (featureCount >= Math.ceil(totalFeatures * 0.5)) return 3;
  return 4;
};

export const rankResults = (results, features) => results.map(result => {
  const featureCount = featureKeys(features).filter(key => result[key] === true).length;
  return { ...result, featureCount, rank: rankFor(featureCount, features.length) };
});

export const matchesRank = (result, rank) => {
  if (rank === RANK_ALL) return true;
  if (rank === null) return result.rank === 1 || result.rank === 2;
  if (rank === RANK_NONE) return result.rank === null;
  return result.rank === rank;
};

export const matchesSearch = (result, search) => {
  const term = (search || '').trim().toLowerCase();
  if (!term) return true;
  return String(result.claimNumber).includes(term) ||
    String(result.publicationNumber || '').toLowerCase().includes(term);
};

// Rank, feature and search filters all apply together
export const filterResults = (ranked, { rank = null, feature = null, search = '' } = {}) => ranked
  .filter(result => matchesRank(result, rank))
  .filter(result => !feature || result[feature] === true)
  .filter(result => matchesSearch(result, search))
  .sort((a, b) => {
    if (a.rank === b.rank) return a.claimNumber - b.claimNumber;
    if (a.rank === null) return 1;
    if (b.rank === null) return -1;
    return a.rank - b.rank;
  });

// One row per filtered patent, with every feature's verdict and the AI's reasoning
export const buildExportRows = (filtered, features, claimText = () => '') => filtered.map(result => {
  const row = {
    'S.No.': result.claimNumber,
    'Publication Number': result.publicationNumber || '',
    'Claims': claimText(result),
    'Rank': result.rank || 'No Rank',
    'Feature Count': `${result.featureCount}/${features.length}`
  };

  features.forEach((feature, index) => {
    row[feature] = result[`feature_${index + 1}`] ? 'Yes' : 'No';
  });

  features.forEach((feature, index) => {
    const analysis = result.detailed_analysis?.[`feature_${index + 1}`] || {};
    row[`${feature} - Confidence`] = analysis.confidence || 'N/A';
    row[`${feature} - Reasoning`] = analysis.reasoning || 'N/A';
    row[`${feature} - Relevant Claims`] = analysis.relevant_claims || 'N/A';
  });

  return row;
});

const RANK_FILE_LABELS = { null: 'rank-1-2', all: 'all-ranks', none: 'no-rank' };

export const exportFileName = ({ rank = null, feature = null }) => {
  const rankPart = RANK_FILE_LABELS[rank] || `rank-${rank}`;
  const featurePart = feature ? `_${feature.replace('_', '-')}` : '';
  return `patent_analysis_${rankPart}${featurePart}.xlsx`;
};
