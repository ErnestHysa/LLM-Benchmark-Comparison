/**
 * Export Utilities
 *
 * Functions to export benchmark results to various formats
 */

export interface CategoryScoreExport {
  category: string;
  score: number;
}

export interface ModelResultExport {
  rank: number;
  modelId: string;
  totalScore: number;
  categoryScores: CategoryScoreExport[];
}

export interface ExportableResult {
  runId: string;
  benchmarkName: string;
  benchmarkDescription: string;
  completedAt: string;
  models: ModelResultExport[];
}

/**
 * Export result data to CSV format
 * Downloads as file in browser
 */
export function exportToCSV(result: ExportableResult): void {
  // Create CSV header
  const headers = [
    "rank",
    "model",
    "total_score",
    ...result.models[0]?.categoryScores.map((c) =>
      c.category.toLowerCase().replace(/\s+/g, "_")
    ) || [],
  ];

  // Create CSV rows
  const rows = result.models.map((model) => {
    const categoryScores = model.categoryScores.map((c) => c.score.toFixed(1));
    return [
      model.rank,
      `"${model.modelId}"`,
      model.totalScore.toFixed(1),
      ...categoryScores,
    ].join(",");
  });

  const csv = [headers.join(","), ...rows].join("\n");

  // Create and download file
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, `${result.benchmarkName.replace(/\s+/g, "_")}_results.csv`);
}

/**
 * Export result data to JSON format
 * Downloads as file in browser
 */
export function exportToJSON(result: ExportableResult): void {
  const json = JSON.stringify(result, null, 2);
  const blob = new Blob([json], { type: "application/json;charset=utf-8;" });
  downloadBlob(blob, `${result.benchmarkName.replace(/\s+/g, "_")}_results.json`);
}

/**
 * Generate a shareable summary text
 * For copying to clipboard or sharing on social media
 */
export function generateShareText(result: ExportableResult): string {
  const winner = result.models[0];

  return `🏆 ${winner?.modelId || "A model"} won "${result.benchmarkName}" with ${winner?.totalScore?.toFixed(1) || "0"}% score!

Testing ${result.models.length} AI models on realistic benchmarks.

📊 View full results: #LLMBenchmark`;
}

/**
 * Copy share text to clipboard
 */
export async function copyShareText(result: ExportableResult): Promise<boolean> {
  try {
    const text = generateShareText(result);
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate a shareable URL
 * In production, this would create a short URL or encoded result ID
 */
export function generateShareUrl(baseUrl: string, resultId: string): string {
  return `${baseUrl}/results/${resultId}`;
}

/**
 * Copy share URL to clipboard
 */
export async function copyShareUrl(url: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate Twitter/X share intent URL
 */
export function getTwitterShareUrl(result: ExportableResult, resultUrl: string): string {
  const text = encodeURIComponent(generateShareText(result));
  const url = encodeURIComponent(resultUrl);
  return `https://twitter.com/intent/tweet?text=${text}&url=${url}`;
}

/**
 * Helper function to download a blob as a file
 */
function downloadBlob(blob: Blob, filename: string): void {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

/**
 * Export to PDF (placeholder for future implementation)
 * Would use jsPDF or react-pdf
 */
export function exportToPDF(result: ExportableResult): void {
  // TODO: Implement PDF export using jsPDF or react-pdf
  // eslint-disable-next-line no-console -- placeholder for future implementation
  console.info("PDF export not yet implemented", result);
}
