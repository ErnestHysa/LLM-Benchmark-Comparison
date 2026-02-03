/**
 * Scoring Engine for LLM Benchmark Platform
 *
 * Algorithms from roadmap "Scoring Calculation" section
 */

export interface Metric {
  name: string;
  score: number; // 0.0 to 100.0
  weight: number; // 0.0 to 1.0 (or higher for relative weighting)
}

export interface CategoryScore {
  category: string;
  score: number; // 0.0 to 100.0
  weight: number; // Category weight in total score
}

/**
 * Calculate metric score (weighted average)
 *
 * Formula: sum(score * weight) / sum(weight)
 *
 * @param metrics - Array of metrics with scores and weights
 * @returns Weighted average score (0-100)
 */
export function calculateMetricScore(metrics: Metric[]): number {
  if (metrics.length === 0) {
    return 0;
  }

  let total = 0;
  let totalWeight = 0;

  for (const metric of metrics) {
    const clampedScore = Math.max(0, Math.min(100, metric.score));
    total += clampedScore * metric.weight;
    totalWeight += metric.weight;
  }

  return totalWeight > 0 ? total / totalWeight : 0;
}

/**
 * Calculate category score (weighted average of metrics)
 *
 * Formula: sum(score * weight) / sum(weight)
 *
 * @param categoryScores - Array of category scores with weights
 * @returns Weighted average score (0-100)
 */
export function calculateCategoryScore(categoryScores: CategoryScore[]): number {
  if (categoryScores.length === 0) {
    return 0;
  }

  let total = 0;
  let totalWeight = 0;

  for (const category of categoryScores) {
    const clampedScore = Math.max(0, Math.min(100, category.score));
    total += clampedScore * category.weight;
    totalWeight += category.weight;
  }

  return totalWeight > 0 ? total / totalWeight : 0;
}

/**
 * Calculate total model score (weighted average of categories)
 *
 * Formula: sum(score * weight) / sum(weight)
 *
 * @param categoryScores - Array of category scores with weights
 * @returns Weighted average score (0-100)
 */
export function calculateTotalScore(categoryScores: CategoryScore[]): number {
  if (categoryScores.length === 0) {
    return 0;
  }

  let total = 0;
  let totalWeight = 0;

  for (const category of categoryScores) {
    const clampedScore = Math.max(0, Math.min(100, category.score));
    total += clampedScore * category.weight;
    totalWeight += category.weight;
  }

  return totalWeight > 0 ? total / totalWeight : 0;
}

/**
 * Calculate score with AI confidence adjustment
 *
 * @param baseScore - The base score (0-100)
 * @param confidence - AI's confidence in this score (0-1)
 * @returns Adjusted score (0-100)
 */
export function adjustScoreByConfidence(baseScore: number, confidence?: number): number {
  if (confidence === undefined || confidence === null) {
    return baseScore;
  }

  // Lower confidence pulls score toward neutral (50)
  const neutralScore = 50;
  const clampedConfidence = Math.max(0, Math.min(1, confidence));

  return baseScore * clampedConfidence + neutralScore * (1 - clampedConfidence);
}

/**
 * Calculate score ranking across multiple models
 *
 * @param scores - Array of model IDs and their scores
 * @returns Array of rankings (lower rank = better)
 */
export interface ModelScore {
  modelId: string;
  score: number;
}

export interface ModelRanking extends ModelScore {
  rank: number;
  percentile: number; // Percentage of models scored below
}

export function calculateRankings(scores: ModelScore[]): ModelRanking[] {
  const sorted = [...scores].sort((a, b) => b.score - a.score);
  const total = sorted.length;

  return sorted.map((entry, index) => ({
    ...entry,
    rank: index + 1,
    percentile: (index / total) * 100,
  }));
}

/**
 * Calculate score percentile
 *
 * @param score - The score to compare
 * @param allScores - All scores in the comparison
 * @returns Percentile (0-100)
 */
export function calculatePercentile(score: number, allScores: number[]): number {
  if (allScores.length === 0) return 0;

  const scoresBelow = allScores.filter((s) => s < score).length;
  const equalScores = allScores.filter((s) => s === score).length;
  const total = allScores.length;

  // Percentile formula: (scores below + 0.5 * equal scores) / total
  return ((scoresBelow + 0.5 * equalScores) / total) * 100;
}

/**
 * Score utilities
 */
export const ScoreUtils = {
  /**
   * Format score as percentage string
   */
  format(score: number): string {
    return `${score.toFixed(1)}%`;
  },

  /**
   * Get score grade (A-F)
   */
  getGrade(score: number): string {
    if (score >= 90) return "A";
    if (score >= 80) return "B";
    if (score >= 70) return "C";
    if (score >= 60) return "D";
    return "F";
  },

  /**
   * Get score color class (for UI)
   */
  getColorClass(score: number): string {
    if (score >= 90) return "text-success";
    if (score >= 80) return "text-info";
    if (score >= 70) return "text-primary";
    if (score >= 60) return "text-warning";
    return "text-error";
  },
};
