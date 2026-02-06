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
 * Build CSV content for export.
 */
export function buildCSVContent(result: ExportableResult): string {
  const categoryColumns = Array.from(
    new Set(result.models.flatMap((model) => model.categoryScores.map((c) => c.category)))
  );

  const headers = [
    "rank",
    "model",
    "total_score",
    ...categoryColumns.map((category) => category.toLowerCase().replace(/\s+/g, "_")),
  ];

  const rows = result.models.map((model) => {
    const categoryScoreMap = new Map(
      model.categoryScores.map((categoryScore) => [categoryScore.category, categoryScore.score])
    );

    return [
      model.rank,
      sanitizeCsvValue(model.modelId),
      model.totalScore.toFixed(1),
      ...categoryColumns.map((category) => {
        const score = categoryScoreMap.get(category);
        return typeof score === "number" ? score.toFixed(1) : "";
      }),
    ].join(",");
  });

  return [headers.join(","), ...rows].join("\n");
}

/**
 * Export result data to CSV format
 * Downloads as file in browser
 */
export function exportToCSV(result: ExportableResult): void {
  const csv = buildCSVContent(result);
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

export function generateShareText(result: ExportableResult): string {
  const winner = result.models[0];

  return `🏆 ${winner?.modelId || "A model"} won "${result.benchmarkName}" with ${winner?.totalScore?.toFixed(1) || "0"}% score!\n\nTesting ${result.models.length} AI models on realistic benchmarks.\n\n📊 View full results: #LLMBenchmark`;
}

export async function copyShareText(result: ExportableResult): Promise<boolean> {
  try {
    const text = generateShareText(result);
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function generateShareUrl(baseUrl: string, resultId: string): string {
  const trimmedBaseUrl = baseUrl.replace(/\/+$/, "");
  return `${trimmedBaseUrl}/results/${resultId}`;
}

export async function copyShareUrl(url: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    return false;
  }
}

export function getTwitterShareUrl(result: ExportableResult, resultUrl: string): string {
  const text = encodeURIComponent(generateShareText(result));
  const url = encodeURIComponent(resultUrl);
  return `https://twitter.com/intent/tweet?text=${text}&url=${url}`;
}

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
 * Export to PDF via browser print dialog.
 */
export function exportToPDF(result: ExportableResult): void {
  const popup = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");

  if (!popup) {
    throw new Error("Unable to open print window. Please allow popups and try again.");
  }

  const rows = result.models
    .map((model) => {
      const categoryBreakdown = model.categoryScores
        .map((score) => `${escapeHtml(score.category)}: ${score.score.toFixed(1)}%`)
        .join(" · ");

      return `<tr><td>${model.rank}</td><td>${escapeHtml(model.modelId)}</td><td>${model.totalScore.toFixed(1)}%</td><td>${categoryBreakdown || "-"}</td></tr>`;
    })
    .join("");

  popup.document.write(
    `<!doctype html><html><head><meta charset="utf-8" /><title>${escapeHtml(result.benchmarkName)} - Results</title><style>body{font-family:Inter,Arial,sans-serif;margin:24px;color:#111827}h1{margin:0 0 8px;font-size:24px}p{margin:0 0 12px;color:#4b5563}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #d1d5db;padding:8px;text-align:left;vertical-align:top}th{background:#f3f4f6}</style></head><body><h1>${escapeHtml(result.benchmarkName)}</h1><p>${escapeHtml(result.benchmarkDescription)}</p><p>Run ID: ${escapeHtml(result.runId)} · Completed: ${escapeHtml(result.completedAt)}</p><table><thead><tr><th>Rank</th><th>Model</th><th>Total Score</th><th>Category Scores</th></tr></thead><tbody>${rows}</tbody></table></body></html>`
  );
  popup.document.close();
  popup.focus();
  popup.print();
}

function sanitizeCsvValue(value: string | number): string {
  const escaped = String(value ?? "").replace(/"/g, '""');
  return /^[=+\-@]/.test(escaped) ? `"'${escaped}"` : `"${escaped}"`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
