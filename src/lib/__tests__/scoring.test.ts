/**
 * Scoring Utilities Tests
 */

import { describe, it, expect, vi } from "vitest";
import {
  calculateMetricScore,
  calculateCategoryScore,
  calculateTotalScore,
  adjustScoreByConfidence,
  calculateRankings,
  calculatePercentile,
  ScoreUtils,
  type Metric,
  type CategoryScore,
} from "../scoring";

// Mock the prisma module
vi.mock("../prisma", () => ({
  prisma: {
    benchmarkRun: {
      findMany: vi.fn(),
    },
  },
}));

describe("Scoring Utilities", () => {
  describe("calculateMetricScore", () => {
    it("should calculate weighted average of metric scores", () => {
      const metrics: Metric[] = [
        { name: "Functionality", score: 90, weight: 0.3 },
        { name: "Code Quality", score: 80, weight: 0.2 },
        { name: "Performance", score: 70, weight: 0.15 },
        { name: "Design", score: 85, weight: 0.15 },
        { name: "Readability", score: 75, weight: 0.1 },
      ];

      const result = calculateMetricScore(metrics);

      // Expected: (90*0.3 + 80*0.2 + 70*0.15 + 85*0.15 + 75*0.1) / 0.9
      // = (27 + 16 + 10.5 + 12.75 + 7.5) / 0.9
      // = 73.75 / 0.9 ≈ 81.94
      expect(result).toBeCloseTo(81.94, 0.1);
    });

    it("should handle empty metrics array", () => {
      const result = calculateMetricScore([]);
      expect(result).toBe(0);
    });

    it("should handle single metric", () => {
      const metrics: Metric[] = [{ name: "Test", score: 85, weight: 1.0 }];
      const result = calculateMetricScore(metrics);
      expect(result).toBe(85);
    });

    it("should clamp scores between 0 and 100", () => {
      const metrics: Metric[] = [
        { name: "High", score: 150, weight: 0.5 },
        { name: "Low", score: -50, weight: 0.5 },
      ];
      const result = calculateMetricScore(metrics);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(100);
      // (100*0.5 + 0*0.5) / 1 = 50
      expect(result).toBe(50);
    });

    it("should handle metrics with missing scores (score defaults to 0)", () => {
      const metrics: Metric[] = [
        { name: "Complete", score: 80, weight: 0.5 },
        { name: "Incomplete", score: 0, weight: 0.3 },
        { name: "No Score", score: 0, weight: 0.2 },
      ];
      const result = calculateMetricScore(metrics);
      expect(result).toBeCloseTo(40, 0.1); // (80*0.5) / 1 = 40
    });
  });

  describe("calculateCategoryScore", () => {
    it("should calculate weighted average of category scores", () => {
      const categories: CategoryScore[] = [
        { category: "CODING", score: 85, weight: 1.0 },
        { category: "WRITING", score: 75, weight: 1.0 },
      ];

      const result = calculateCategoryScore(categories);
      expect(result).toBe(80); // (85 + 75) / 2
    });

    it("should handle empty categories", () => {
      const result = calculateCategoryScore([]);
      expect(result).toBe(0);
    });

    it("should respect category weights", () => {
      const categories: CategoryScore[] = [
        { category: "CODING", score: 90, weight: 2.0 },
        { category: "WRITING", score: 70, weight: 1.0 },
      ];

      const result = calculateCategoryScore(categories);
      expect(result).toBeCloseTo(83.33, 0.1); // (90*2 + 70*1) / 3
    });
  });

  describe("calculateTotalScore", () => {
    it("should calculate total score from categories", () => {
      const categories: CategoryScore[] = [
        { category: "CODING", score: 85, weight: 1.0 },
        { category: "WRITING", score: 75, weight: 1.0 },
        { category: "REASONING", score: 80, weight: 1.0 },
      ];

      const result = calculateTotalScore(categories);
      expect(result).toBe(80); // (85 + 75 + 80) / 3
    });

    it("should handle empty categories", () => {
      const result = calculateTotalScore([]);
      expect(result).toBe(0);
    });
  });

  describe("adjustScoreByConfidence", () => {
    it("should return base score when confidence is undefined", () => {
      const result = adjustScoreByConfidence(85);
      expect(result).toBe(85);
    });

    it("should keep score same with full confidence", () => {
      const result = adjustScoreByConfidence(85, 1.0);
      expect(result).toBe(85);
    });

    it("should pull score toward neutral with low confidence", () => {
      const result = adjustScoreByConfidence(90, 0.5);
      // 90 * 0.5 + 50 * 0.5 = 45 + 25 = 70
      expect(result).toBe(70);
    });

    it("should return neutral score with zero confidence", () => {
      const result = adjustScoreByConfidence(90, 0);
      expect(result).toBe(50);
    });
  });

  describe("calculateRankings", () => {
    it("should rank models by score descending", () => {
      const scores = [
        { modelId: "model-1", score: 85 },
        { modelId: "model-2", score: 92 },
        { modelId: "model-3", score: 78 },
      ];

      const result = calculateRankings(scores);

      expect(result[0].modelId).toBe("model-2");
      expect(result[0].rank).toBe(1);
      expect(result[0].percentile).toBe(0);

      expect(result[1].modelId).toBe("model-1");
      expect(result[1].rank).toBe(2);
      expect(result[1].percentile).toBeCloseTo(33.33, 0.1);

      expect(result[2].modelId).toBe("model-3");
      expect(result[2].rank).toBe(3);
      expect(result[2].percentile).toBeCloseTo(66.67, 0.1);
    });

    it("should handle empty scores", () => {
      const result = calculateRankings([]);
      expect(result).toEqual([]);
    });
  });

  describe("calculatePercentile", () => {
    it("should calculate percentile correctly", () => {
      const allScores = [70, 80, 85, 90, 92];
      const result = calculatePercentile(85, allScores);
      // (2 below + 0.5 * 1 equal) / 5 = 2.5/5 = 50%
      expect(result).toBe(50);
    });

    it("should return 0 for empty array", () => {
      const result = calculatePercentile(85, []);
      expect(result).toBe(0);
    });

    it("should return highest percentile for top score", () => {
      const allScores = [70, 80, 85, 90, 92];
      const result = calculatePercentile(92, allScores);
      // (4 below + 0.5 * 1 equal) / 5 = 4.5/5 = 90%
      expect(result).toBe(90);
    });
  });

  describe("ScoreUtils", () => {
    describe("format", () => {
      it("should format score as percentage", () => {
        expect(ScoreUtils.format(85.456)).toBe("85.5%");
        expect(ScoreUtils.format(90)).toBe("90.0%");
      });
    });

    describe("getGrade", () => {
      it("should return correct grade", () => {
        expect(ScoreUtils.getGrade(95)).toBe("A");
        expect(ScoreUtils.getGrade(85)).toBe("B");
        expect(ScoreUtils.getGrade(75)).toBe("C");
        expect(ScoreUtils.getGrade(65)).toBe("D");
        expect(ScoreUtils.getGrade(55)).toBe("F");
      });
    });

    describe("getColorClass", () => {
      it("should return correct color class", () => {
        expect(ScoreUtils.getColorClass(95)).toBe("text-success");
        expect(ScoreUtils.getColorClass(85)).toBe("text-info");
        expect(ScoreUtils.getColorClass(75)).toBe("text-primary");
        expect(ScoreUtils.getColorClass(65)).toBe("text-warning");
        expect(ScoreUtils.getColorClass(55)).toBe("text-error");
      });
    });
  });
});
