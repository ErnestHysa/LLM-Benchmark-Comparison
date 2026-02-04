/**
 * Benchmark History - LocalStorage Persistence
 *
 * Stores benchmark run summaries in localStorage for quick access.
 * Complements the database-backed history with client-side persistence.
 */

export interface BenchmarkRunSummary {
  id: string;
  timestamp: number;
  duration: number;
  benchmarkName: string;
  benchmarkId: string;
  modelsCount: number;
  completedCount: number;
  failedCount: number;
  topModel?: string;
  topScore?: number;
  results: BenchmarkModelResult[];
}

export interface BenchmarkModelResult {
  modelId: string;
  status: "COMPLETED" | "FAILED";
  totalScore: number;
  error?: string;
}

const STORAGE_KEY = "benchmark_history";
const MAX_HISTORY = 50;

/**
 * Save a benchmark run summary to localStorage
 */
export function saveBenchmarkRun(run: BenchmarkRunSummary): void {
  if (typeof window === "undefined") return;

  try {
    const history = getBenchmarkHistory();
    history.unshift(run);

    // Keep only the most recent runs
    if (history.length > MAX_HISTORY) {
      history.length = MAX_HISTORY;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch (error) {
    console.error("Error saving benchmark history:", error);
  }
}

/**
 * Get all benchmark run summaries from localStorage
 */
export function getBenchmarkHistory(): BenchmarkRunSummary[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error("Error loading benchmark history:", error);
    return [];
  }
}

/**
 * Get a single benchmark run by ID
 */
export function getBenchmarkRun(id: string): BenchmarkRunSummary | undefined {
  return getBenchmarkHistory().find((run) => run.id === id);
}

/**
 * Clear all benchmark history
 */
export function clearBenchmarkHistory(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Delete a specific run from history
 */
export function deleteBenchmarkRun(id: string): void {
  if (typeof window === "undefined") return;

  try {
    const history = getBenchmarkHistory().filter((run) => run.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch (error) {
    console.error("Error deleting benchmark run:", error);
  }
}

/**
 * Get history statistics
 */
export function getHistoryStats(): {
  totalRuns: number;
  totalModels: number;
  avgScore: number;
  lastRunDate: number | null;
} {
  const history = getBenchmarkHistory();

  if (history.length === 0) {
    return { totalRuns: 0, totalModels: 0, avgScore: 0, lastRunDate: null };
  }

  const totalModels = history.reduce((sum, run) => sum + run.modelsCount, 0);
  const scores = history
    .flatMap((run) => run.results)
    .filter((r) => r.status === "COMPLETED")
    .map((r) => r.totalScore);
  const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

  return {
    totalRuns: history.length,
    totalModels,
    avgScore,
    lastRunDate: history[0]?.timestamp ?? null,
  };
}
