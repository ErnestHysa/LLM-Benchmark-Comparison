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

  if (!winner) {
    return `Benchmark "${result.benchmarkName}" completed!

Testing ${result.models.length} AI models on realistic benchmarks.

📊 View full results: #LLMBenchmark`;
  }

  return `🏆 ${winner.modelId} won "${result.benchmarkName}" with ${winner.totalScore.toFixed(1)}% score!

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
 * Export to PDF using browser's print functionality
 * Creates a print-friendly HTML document and triggers print dialog
 */
export function exportToPDF(result: ExportableResult): void {
  // Create a print-friendly HTML document
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    console.error("Failed to open print window. Please allow popups for this site.");
    return;
  }

  const styles = `
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
        line-height: 1.6;
        color: #1a1a1a;
        max-width: 800px;
        margin: 0 auto;
        padding: 20px;
      }
      h1 {
        color: #2563eb;
        border-bottom: 2px solid #e5e7eb;
        padding-bottom: 10px;
      }
      .meta {
        color: #6b7280;
        font-size: 14px;
        margin-bottom: 20px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 20px;
      }
      th, td {
        border: 1px solid #e5e7eb;
        padding: 12px;
        text-align: left;
      }
      th {
        background-color: #f9fafb;
        font-weight: 600;
      }
      .rank-1 { background-color: #fef3c7; font-weight: 600; }
      .rank-2 { background-color: #fef9c3; }
      .rank-3 { background-color: #fffbeb; }
      .score-bar {
        background-color: #e5e7eb;
        height: 8px;
        border-radius: 4px;
        overflow: hidden;
        margin-top: 4px;
      }
      .score-fill {
        background-color: #2563eb;
        height: 100%;
        transition: width 0.3s ease;
      }
      .category-scores {
        font-size: 12px;
        color: #6b7280;
      }
      @media print {
        body { padding: 0; }
        .no-print { display: none; }
      }
    </style>
  `;

  const tableRows = result.models
    .sort((a, b) => b.totalScore - a.totalScore)
    .map((model, index) => {
      const rank = index + 1;
      const rankClass = rank <= 3 ? `rank-${rank}` : "";
      const scorePercent = model.totalScore;
      const categoryScoresHtml = model.categoryScores
        .map((cat) => `<div>${cat.category}: ${cat.score.toFixed(1)}</div>`)
        .join("");

      return `
        <tr class="${rankClass}">
          <td>${rank}</td>
          <td><strong>${model.modelId}</strong></td>
          <td>
            <div>${model.totalScore.toFixed(1)}%</div>
            <div class="score-bar">
              <div class="score-fill" style="width: ${scorePercent}%"></div>
            </div>
            <div class="category-scores">${categoryScoresHtml}</div>
          </td>
        </tr>
      `;
    })
    .join("");

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${result.benchmarkName} - Results</title>
        <meta charset="UTF-8">
        ${styles}
      </head>
      <body>
        <h1>${result.benchmarkName}</h1>
        <div class="meta">
          <p><strong>Description:</strong> ${result.benchmarkDescription}</p>
          <p><strong>Completed:</strong> ${new Date(result.completedAt).toLocaleString()}</p>
          <p><strong>Models Tested:</strong> ${result.models.length}</p>
        </div>

        <h2>Results</h2>
        <table>
          <thead>
            <tr>
              <th style="width: 60px;">Rank</th>
              <th>Model</th>
              <th style="width: 200px;">Total Score</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>

        <div class="meta no-print" style="margin-top: 40px; text-align: center;">
          <p>Generated by LLM Benchmark Comparison Platform</p>
        </div>
      </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();

  // Wait for the document to load, then trigger print
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 250);
  };
}
