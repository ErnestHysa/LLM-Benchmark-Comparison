import { describe, expect, it } from "vitest";
import { evaluateBenchmarkQuality, summarizeBenchmarkQuality } from "../benchmark-quality";

describe("benchmark-quality", () => {
  it("scores high quality benchmarks as excellent", () => {
    const result = evaluateBenchmarkQuality({
      id: "b1",
      name: "Full Stack Agent Task",
      hasDescription: true,
      hasPrompt: true,
      hasDifficulty: true,
      hasEstimatedTokens: true,
      hasTags: true,
      categoryCount: 3,
      runCount: 18,
      uniqueModelCount: 6,
      avgScore: 78,
    });

    expect(result.score).toBeGreaterThanOrEqual(85);
    expect(result.grade).toBe("excellent");
    expect(result.improvements.length).toBeLessThanOrEqual(2);
  });

  it("flags missing metadata and low run diversity", () => {
    const result = evaluateBenchmarkQuality({
      id: "b2",
      name: "Sparse benchmark",
      hasDescription: true,
      hasPrompt: false,
      hasDifficulty: false,
      hasEstimatedTokens: false,
      hasTags: false,
      categoryCount: 1,
      runCount: 1,
      uniqueModelCount: 1,
      avgScore: null,
    });

    expect(result.grade).toBe("needs-work");
    expect(result.improvements).toContain("Add a concrete prompt with expected constraints");
    expect(result.improvements).toContain("Run against at least 3 distinct models for reliable comparisons");
  });

  it("aggregates summary and shared improvement priorities", () => {
    const summary = summarizeBenchmarkQuality([
      {
        id: "1",
        name: "A",
        score: 90,
        grade: "excellent",
        strengths: [],
        improvements: ["Increase run count to improve statistical confidence"],
      },
      {
        id: "2",
        name: "B",
        score: 70,
        grade: "good",
        strengths: [],
        improvements: ["Increase run count to improve statistical confidence"],
      },
      {
        id: "3",
        name: "C",
        score: 52,
        grade: "needs-work",
        strengths: [],
        improvements: ["Add estimated token budget for cost predictability"],
      },
    ]);

    expect(summary.counts.excellent).toBe(1);
    expect(summary.counts.good).toBe(1);
    expect(summary.counts.needsWork).toBe(1);
    expect(summary.topImprovements[0]).toBe("Increase run count to improve statistical confidence");
  });
});
