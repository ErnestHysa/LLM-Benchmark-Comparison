/**
 * Utils Tests
 */

import { describe, it, expect } from "vitest";
import { cn, formatNumber, formatScore, formatDuration } from "../utils";

describe("Utils", () => {
  describe("cn", () => {
    it("should merge class names correctly", () => {
      expect(cn("px-2", "py-1")).toBe("px-2 py-1");
    });

    it("should handle conditional classes", () => {
      expect(cn("base", true && "active", false && "inactive")).toBe("base active");
    });

    it("should handle undefined and null values", () => {
      expect(cn("base", undefined, null, "end")).toBe("base end");
    });

    it("should merge Tailwind classes with proper precedence", () => {
      // twMerge ensures later classes override earlier conflicting ones
      expect(cn("px-2", "px-4")).toBe("px-4");
    });
  });

  describe("formatNumber", () => {
    it("should format numbers with commas", () => {
      expect(formatNumber(1000)).toBe("1,000");
      expect(formatNumber(1000000)).toBe("1,000,000");
      expect(formatNumber(1234567.89)).toBe("1,234,567.89");
    });

    it("should handle small numbers", () => {
      expect(formatNumber(0)).toBe("0");
      expect(formatNumber(42)).toBe("42");
    });

    it("should handle negative numbers", () => {
      expect(formatNumber(-1000)).toBe("-1,000");
    });
  });

  describe("formatScore", () => {
    it("should format score as percentage with one decimal", () => {
      expect(formatScore(85.456)).toBe("85.5%");
      expect(formatScore(90)).toBe("90.0%");
      expect(formatScore(75.123)).toBe("75.1%");
    });

    it("should handle edge cases", () => {
      expect(formatScore(0)).toBe("0.0%");
      expect(formatScore(100)).toBe("100.0%");
    });
  });

  describe("formatDuration", () => {
    it("should format seconds correctly", () => {
      expect(formatDuration(5)).toBe("5s");
      expect(formatDuration(30)).toBe("30s");
      expect(formatDuration(59)).toBe("59s");
    });

    it("should format minutes and seconds", () => {
      expect(formatDuration(60)).toBe("1m");
      expect(formatDuration(90)).toBe("1m 30s");
      expect(formatDuration(125)).toBe("2m 5s");
    });

    it("should format hours and minutes", () => {
      expect(formatDuration(3600)).toBe("1h");
      expect(formatDuration(3660)).toBe("1h 1m");
      expect(formatDuration(7260)).toBe("2h 1m");
    });

    it("should handle zero", () => {
      expect(formatDuration(0)).toBe("0s");
    });
  });
});
