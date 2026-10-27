import { rankResults } from '../Screening/resultsFilter';

const isFailed = (result) => !!result.detailed_analysis?.feature_1?.reasoning?.startsWith('Analysis failed');

const highConfidenceCount = (result, features) => features
  .filter((_, index) => {
    const analysis = result.detailed_analysis?.[`feature_${index + 1}`];
    return analysis?.present && analysis.confidence?.toLowerCase() === 'high';
  }).length;

// Everything the Overview and Dashboard show, computed once from the results.
// Percentages are of analyzed patents; failed ones are counted separately.
export const computeDashboardStats = (results, features) => {
  const ranked = rankResults(results, features);
  const analyzed = ranked.filter(r => !isFailed(r));
  const total = analyzed.length;
  const share = (count) => (total ? count / total : 0);

  const rankCounts = [1, 2, 3, 4].map(rank => analyzed.filter(r => r.rank === rank).length);
  const noRank = analyzed.filter(r => r.rank === null).length;
  const highPriority = rankCounts[0] + rankCounts[1];

  const featureStats = features.map((name, index) => {
    const count = analyzed.filter(r => r[`feature_${index + 1}`] === true).length;
    return { name, count, share: share(count) };
  });

  // cooccurrence[i][j]: patents where both feature i and feature j are present
  const cooccurrence = features.map((_, i) => features.map((__, j) =>
    analyzed.filter(r => r[`feature_${i + 1}`] === true && r[`feature_${j + 1}`] === true).length
  ));

  const featureMatches = analyzed.reduce((sum, r) => sum + r.featureCount, 0);

  const topRisk = analyzed
    .filter(r => r.rank !== null)
    .map(r => ({ ...r, highConfidence: highConfidenceCount(r, features) }))
    .sort((a, b) =>
      a.rank - b.rank ||
      b.featureCount - a.featureCount ||
      b.highConfidence - a.highConfidence ||
      a.claimNumber - b.claimNumber
    )
    .slice(0, 10);

  const mostCommon = featureStats.reduce((best, f) => (!best || f.count > best.count ? f : best), null);

  return {
    total,
    failed: ranked.length - total,
    rankCounts,
    noRank,
    highPriority,
    highPriorityShare: share(highPriority),
    averageFeatures: total ? featureMatches / total : 0,
    featureStats,
    cooccurrence,
    topRisk,
    mostCommon
  };
};

export const formatPercent = (value) => `${Math.round(value * 100)}%`;
