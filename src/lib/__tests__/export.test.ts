/**
 * Export Utilities Tests
 */

import { describe, it, expect } from "vitest";
import {
  generateShareText,
  generateShareUrl,
  getTwitterShareUrl,
  type ExportableResult,
} from "../export";

describe("Export Utilities", () => {
  describe("generateShareText", () => {
    it("should generate share text with winner and score", () => {
      const result: ExportableResult = {
        runId: "run-1",
        benchmarkName: "Test Benchmark",
        benchmarkDescription: "A test benchmark",
        completedAt: "2024-01-01T00:00:00Z",
        models: [
          {
            rank: 1,
            modelId: "GPT-4o",
            totalScore: 92.5,
            categoryScores: [],
          },
          {
            rank: 2,
            modelId: "Claude 3.5 Sonnet",
            totalScore: 88.3,
            categoryScores: [],
          },
        ],
      };

      const text = generateShareText(result);

      expect(text).toContain("GPT-4o");
      expect(text).toContain("92.5%");
      expect(text).toContain("Test Benchmark");
      expect(text).toContain("2 AI models");
    });

    it("should handle empty models array", () => {
      const result: ExportableResult = {
        runId: "run-1",
        benchmarkName: "Empty Benchmark",
        benchmarkDescription: "No models",
        completedAt: "2024-01-01T00:00:00Z",
        models: [],
      };

      const text = generateShareText(result);

      expect(text).toContain("0 AI models");
    });
  });

  describe("generateShareUrl", () => {
    it("should generate correct share URL", () => {
      const url = generateShareUrl("https://example.com", "run-123");

      expect(url).toBe("https://example.com/results/run-123");
    });

    it("should normalize base URL with trailing slash", () => {
      const url = generateShareUrl("https://example.com/", "run-123");

      expect(url).toBe("https://example.com/results/run-123");
    });
  });

  describe("getTwitterShareUrl", () => {
    it("should generate Twitter share intent URL", () => {
      const result: ExportableResult = {
        runId: "run-1",
        benchmarkName: "Test Benchmark",
        benchmarkDescription: "A test benchmark",
        completedAt: "2024-01-01T00:00:00Z",
        models: [
          {
            rank: 1,
            modelId: "GPT-4o",
            totalScore: 92.5,
            categoryScores: [],
          },
        ],
      };

      const twitterUrl = getTwitterShareUrl(result, "https://example.com/results/run-1");

      expect(twitterUrl).toContain("https://twitter.com/intent/tweet");
      expect(twitterUrl).toContain("text=");
      expect(twitterUrl).toContain("url=");
      expect(twitterUrl).toContain("GPT-4o");
    });
  });
});

describe("CSV export shape", () => {
  it("should include all category columns across models", async () => {
    const { buildCSVContent } = await import("../export");
    const result: ExportableResult = {
      runId: "run-1",
      benchmarkName: "CSV Benchmark",
      benchmarkDescription: "CSV test",
      completedAt: "2024-01-01T00:00:00Z",
      models: [
        {
          rank: 1,
          modelId: "model-a",
          totalScore: 90,
          categoryScores: [{ category: "Safety", score: 95 }],
        },
        {
          rank: 2,
          modelId: "model-b",
          totalScore: 80,
          categoryScores: [{ category: "Performance", score: 88 }],
        },
      ],
    };

    const csvText = buildCSVContent(result);

    expect(csvText).toContain("safety");
    expect(csvText).toContain("performance");
  });
});
