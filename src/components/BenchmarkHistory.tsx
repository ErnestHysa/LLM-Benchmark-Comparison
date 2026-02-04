/**
 * Benchmark History Component
 *
 * Client-side component showing locally stored benchmark run history.
 * Shows recent runs with quick stats and allows clearing history.
 */

"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  History,
  Trash2,
  ChevronDown,
  ChevronUp,
  Crown,
  Clock,
  Users,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  getBenchmarkHistory,
  clearBenchmarkHistory,
  deleteBenchmarkRun,
  type BenchmarkRunSummary,
} from "@/lib/storage/benchmark-history";

interface BenchmarkHistoryProps {
  className?: string;
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSecs = seconds % 60;
  return `${minutes}m ${remainingSecs}s`;
}

function formatTimestamp(ts: number): string {
  const date = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function BenchmarkHistory({ className }: BenchmarkHistoryProps) {
  const [history, setHistory] = useState<BenchmarkRunSummary[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && showHistory) {
      setHistory(getBenchmarkHistory());
    }
  }, [mounted, showHistory]);

  if (!mounted) return null;

  return (
    <div className={className}>
      <Button
        variant="outline"
        onClick={() => {
          setShowHistory(!showHistory);
          if (!showHistory) {
            setHistory(getBenchmarkHistory());
          }
        }}
        className="gap-2"
      >
        <History className="h-4 w-4" />
        {showHistory ? "Hide" : "Show"} Local History
        {showHistory ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </Button>

      {showHistory && (
        <div className="mt-4 animate-fade-in">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Benchmark History</CardTitle>
              {history.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-error hover:text-error"
                  onClick={() => setClearDialogOpen(true)}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Clear History
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <p className="text-muted-foreground text-center py-6">
                  No local benchmark history yet. Run a benchmark to see results here.
                </p>
              ) : (
                <div className="space-y-3">
                  {history.map((run) => (
                    <div
                      key={run.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-surface-hover/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-foreground truncate">
                            {run.benchmarkName}
                          </p>
                          <Badge variant="outline" className="text-xs">
                            {run.completedCount}/{run.modelsCount} models
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatTimestamp(run.timestamp)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {formatDuration(run.duration)}
                          </span>
                          {run.topModel && (
                            <span className="flex items-center gap-1">
                              <Crown className="h-3 w-3 text-primary" />
                              {run.topModel}: {run.topScore?.toFixed(1)}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 flex-shrink-0"
                        onClick={() => {
                          deleteBenchmarkRun(run.id);
                          setHistory((prev) => prev.filter((r) => r.id !== run.id));
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Clear History Confirmation */}
          <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear benchmark history?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will remove all locally stored benchmark history.
                  Database records will not be affected.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    clearBenchmarkHistory();
                    setHistory([]);
                    setClearDialogOpen(false);
                  }}
                  className="bg-error text-error-foreground hover:bg-error/90"
                >
                  Clear All
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );
}
