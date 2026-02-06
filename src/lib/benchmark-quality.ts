export interface BenchmarkQualityInput {
  id: string;
  name: string;
  hasDescription: boolean;
  hasPrompt: boolean;
  hasDifficulty: boolean;
  hasEstimatedTokens: boolean;
  hasTags: boolean;
  categoryCount: number;
  runCount: number;
  uniqueModelCount: number;
  avgScore: number | null;
}

export interface BenchmarkQualityResult {
  id: string;
  name: string;
  score: number;
  grade: "excellent" | "good" | "needs-work";
  strengths: string[];
  improvements: string[];
}

export interface BenchmarkQualitySummary {
  overallScore: number;
  grade: "excellent" | "good" | "needs-work";
  counts: {
    excellent: number;
    good: number;
    needsWork: number;
  };
  topImprovements: string[];
}

function toGrade(score: number): BenchmarkQualityResult["grade"] {
  if (score >= 85) return "excellent";
  if (score >= 65) return "good";
  return "needs-work";
}

function scoreBenchmark(input: BenchmarkQualityInput): number {
  let score = 0;

  if (input.hasDescription) score += 12;
  if (input.hasPrompt) score += 18;
  if (input.hasDifficulty) score += 8;
  if (input.hasEstimatedTokens) score += 8;
  if (input.hasTags) score += 8;

  score += Math.min(input.categoryCount, 3) * 6;
  score += Math.min(input.runCount, 20) * 1.2;
  score += Math.min(input.uniqueModelCount, 8) * 2.5;

  if (input.avgScore !== null) {
    score += 10;
  }

  return Math.min(100, Math.round(score));
}

export function evaluateBenchmarkQuality(input: BenchmarkQualityInput): BenchmarkQualityResult {
  const score = scoreBenchmark(input);
  const grade = toGrade(score);
  const strengths: string[] = [];
  const improvements: string[] = [];

  if (input.hasPrompt) strengths.push("Clear benchmark prompt provided");
  else improvements.push("Add a concrete prompt with expected constraints");

  if (input.categoryCount >= 2) strengths.push("Multi-category scoring coverage");
  else improvements.push("Map this benchmark to at least two scoring categories");

  if (input.uniqueModelCount >= 3) strengths.push("Sufficient model diversity in historical runs");
  else improvements.push("Run against at least 3 distinct models for reliable comparisons");

  if (input.runCount >= 5) strengths.push("Enough runs for trend detection");
  else improvements.push("Increase run count to improve statistical confidence");

  if (!input.hasDifficulty) improvements.push("Set difficulty to improve benchmark portfolio balancing");
  if (!input.hasEstimatedTokens) improvements.push("Add estimated token budget for cost predictability");
  if (!input.hasTags) improvements.push("Tag benchmark capabilities (e.g. tool-use, planning, coding)");

  return {
    id: input.id,
    name: input.name,
    score,
    grade,
    strengths: strengths.slice(0, 3),
    improvements: improvements.slice(0, 4),
  };
}

export function summarizeBenchmarkQuality(results: BenchmarkQualityResult[]): BenchmarkQualitySummary {
  if (results.length === 0) {
    return {
      overallScore: 0,
      grade: "needs-work",
      counts: { excellent: 0, good: 0, needsWork: 0 },
      topImprovements: ["Create benchmarks to start tracking readiness"],
    };
  }

  const totals = results.reduce(
    (acc, result) => {
      acc.score += result.score;
      if (result.grade === "excellent") acc.excellent += 1;
      else if (result.grade === "good") acc.good += 1;
      else acc.needsWork += 1;

      for (const item of result.improvements) {
        acc.improvements.set(item, (acc.improvements.get(item) || 0) + 1);
      }

      return acc;
    },
    { score: 0, excellent: 0, good: 0, needsWork: 0, improvements: new Map<string, number>() }
  );

  const overallScore = Math.round(totals.score / results.length);
  const grade = toGrade(overallScore);

  const topImprovements = Array.from(totals.improvements.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([item]) => item);

  return {
    overallScore,
    grade,
    counts: {
      excellent: totals.excellent,
      good: totals.good,
      needsWork: totals.needsWork,
    },
    topImprovements,
  };
}
