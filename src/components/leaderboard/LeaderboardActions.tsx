/**
 * Leaderboard Actions Component
 *
 * Client component providing export (CSV/JSON) and model comparison
 * functionality for the leaderboard page.
 */

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, GitCompare } from "lucide-react";
import { ModelComparison } from "@/components/ModelComparison";

export interface LeaderboardEntry {
  modelId: string;
  avgScore: number;
  runCount: number;
}

interface LeaderboardActionsProps {
  entries: LeaderboardEntry[];
}

function exportLeaderboardToCSV(entries: LeaderboardEntry[]) {
  const headers = ["Rank", "Model", "Average Score", "Runs"];
  const rows = entries.map((entry, index) => [
    index + 1,
    `"${entry.modelId}"`,
    entry.avgScore.toFixed(2),
    entry.runCount,
  ]);

  const csv = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `leaderboard-${Date.now()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

function exportLeaderboardToJSON(entries: LeaderboardEntry[]) {
  const data = entries.map((entry, index) => ({
    rank: index + 1,
    modelId: entry.modelId,
    avgScore: entry.avgScore,
    runCount: entry.runCount,
  }));

  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `leaderboard-${Date.now()}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

export function LeaderboardActions({ entries }: LeaderboardActionsProps) {
  const [showComparison, setShowComparison] = useState(false);

  if (entries.length === 0) return null;

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportLeaderboardToCSV(entries)}
        >
          <Download className="h-4 w-4 mr-1" />
          CSV
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportLeaderboardToJSON(entries)}
        >
          <Download className="h-4 w-4 mr-1" />
          JSON
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowComparison(true)}
        >
          <GitCompare className="h-4 w-4 mr-1" />
          Compare Models
        </Button>
      </div>

      {showComparison && (
        <ModelComparison
          models={entries}
          onClose={() => setShowComparison(false)}
        />
      )}
    </>
  );
}
