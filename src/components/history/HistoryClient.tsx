/**
 * History Client Component
 *
 * Client-side features for history page including bulk delete with checkboxes
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ChevronRight,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  Trash2,
  MoreVertical,
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
import { addToast } from "@/components/ui/toaster";

interface ModelRun {
  id: string;
  modelId: string;
  status: string;
}

interface BenchmarkRun {
  id: string;
  benchmark: {
    id: string;
    name: string;
    primaryCategory: string;
  };
  modelRuns: ModelRun[];
  status: string;
  startedAt: Date;
}

interface HistoryClientProps {
  runs: BenchmarkRun[];
}

function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    CODING: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    WRITING: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    REASONING: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    DEBUGGING: "bg-red-500/10 text-red-500 border-red-500/20",
    API_DESIGN: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    DATABASE_SCHEMA: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
    UI_UX_DESIGN: "bg-pink-500/10 text-pink-500 border-pink-500/20",
    DATA_ANALYSIS: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  };
  return colors[category] || "";
}

export function HistoryClient({ runs }: HistoryClientProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [runsToDelete, setRunsToDelete] = useState<string[]>([]);

  const isAllSelected = runs.length > 0 && selectedIds.size === runs.length;
  const isSomeSelected = selectedIds.size > 0 && !isAllSelected;

  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(runs.map((r) => r.id)));
    }
  };

  const handleSelectOne = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const openDeleteDialog = (ids: string[]) => {
    setRunsToDelete(ids);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/benchmark-runs?ids=${runsToDelete.join(",")}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete runs");
      }

      const data = await response.json();

      addToast({
        title: "Deleted successfully",
        description: `Deleted ${data.deletedCount} benchmark run(s)`,
        variant: "success",
      });

      // Refresh the page to show updated data
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error) {
      console.error("Delete error:", error);
      addToast({
        title: "Delete failed",
        description: "Could not delete the selected runs. Please try again.",
        variant: "error",
      });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setRunsToDelete([]);
      setSelectedIds(new Set());
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.size > 0) {
      openDeleteDialog(Array.from(selectedIds));
    }
  };

  function getStatusBadge(status: string) {
    switch (status) {
      case "COMPLETED":
        return (
          <Badge className="bg-success/10 text-success border-success/20">
            <CheckCircle className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        );
      case "FAILED":
        return (
          <Badge className="bg-error/10 text-error border-error/20">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      case "TIMEOUT":
        return (
          <Badge className="bg-warning/10 text-warning border-warning/20">
            <AlertCircle className="h-3 w-3 mr-1" />
            Timeout
          </Badge>
        );
      case "RUNNING":
        return (
          <Badge className="bg-info/10 text-info border-info/20">
            <Clock className="h-3 w-3 mr-1" />
            Running
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  }

  if (runs.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center text-muted-foreground">
          <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No benchmark runs found.</p>
          <p className="text-sm mt-2">
            Try adjusting your filters or run a new benchmark.
          </p>
          <Link href="/benchmarks" className="inline-block mt-4">
            <Button>Browse Benchmarks</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardContent className="p-0">
          {/* Bulk actions bar */}
          {isSomeSelected && (
            <div className="bg-primary/10 border-b border-primary/20 p-3 flex items-center justify-between animate-fade-in">
              <span className="text-sm text-foreground">
                {selectedIds.size} run{selectedIds.size !== 1 ? "s" : ""} selected
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedIds(new Set())}
                >
                  Clear selection
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDelete}
                  className="gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete selected
                </Button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-surface/50">
                  <th className="py-3 px-4 w-10">
                    <Checkbox
                      checked={isAllSelected}
                      onCheckedChange={handleSelectAll}
                      aria-label="Select all runs"
                    />
                  </th>
                  <th className="py-3 px-4 text-left text-sm font-medium text-muted-foreground">
                    Benchmark
                  </th>
                  <th className="py-3 px-4 text-left text-sm font-medium text-muted-foreground">
                    Category
                  </th>
                  <th className="py-3 px-4 text-left text-sm font-medium text-muted-foreground">
                    Models
                  </th>
                  <th className="py-3 px-4 text-left text-sm font-medium text-muted-foreground">
                    Status
                  </th>
                  <th className="py-3 px-4 text-left text-sm font-medium text-muted-foreground">
                    Date
                  </th>
                  <th className="py-3 px-4 text-right text-sm font-medium text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr
                    key={run.id}
                    className={`border-b border-border/50 transition-colors ${
                      selectedIds.has(run.id)
                        ? "bg-primary/10"
                        : "hover:bg-surface-hover/50"
                    }`}
                  >
                    <td className="py-3 px-4">
                      <Checkbox
                        checked={selectedIds.has(run.id)}
                        onCheckedChange={() => handleSelectOne(run.id)}
                        aria-label={`Select ${run.benchmark.name}`}
                      />
                    </td>
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium text-foreground">
                          {run.benchmark.name}
                        </p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {run.id.slice(0, 8)}...
                        </p>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge
                        variant="outline"
                        className={getCategoryColor(run.benchmark.primaryCategory)}
                      >
                        {run.benchmark.primaryCategory.replace("_", " ")}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {run.modelRuns.length} models
                    </td>
                    <td className="py-3 px-4">
                      {getStatusBadge(run.status)}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground text-sm">
                      {run.startedAt.toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/results/${run.id}`}>
                          <Button variant="ghost" size="sm">
                            View
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                        </Link>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => openDeleteDialog([run.id])}
                              className="text-error focus:text-error"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {runsToDelete.length} run{runsToDelete.length !== 1 ? "s" : ""}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              benchmark run{runsToDelete.length !== 1 ? "s" : ""} and all
              associated results. The deleted runs will be removed from
              leaderboard calculations.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-error text-error-foreground hover:bg-error/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
