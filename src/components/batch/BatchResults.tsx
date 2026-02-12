/**
 * Batch Results Component
 *
 * Display results from a completed batch run
 */

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Trophy,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  DollarSign,
  Download,
  RefreshCw,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface BatchResult {
  benchmarkRunId: string;
  benchmarkId: string;
  benchmarkName: string;
  modelId: string;
  modelName: string;
  status: string;
  score?: number;
  tokensUsed?: number;
  cost?: number;
  duration?: number;
  rank?: number;
  errorMessage?: string;
}

interface BatchSummary {
  totalRuns: number;
  completedRuns: number;
  failedRuns: number;
  avgScore?: number;
  modelComparison: Array<{
    modelId: string;
    modelName: string;
    avgScore: number;
    minScore: number;
    maxScore: number;
    runCount: number;
    rank: number;
  }>;
}

interface BatchResultsProps {
  batchId: string;
}

export function BatchResults({ batchId }: BatchResultsProps) {
  const { toast } = useToast();
  const [batch, setBatch] = useState<any>(null);
  const [results, setResults] = useState<BatchResult[]>([]);
  const [summary, setSummary] = useState<BatchSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchResults = async (showRefreshLoading = false) => {
    if (showRefreshLoading) setRefreshing(true);

    try {
      const response = await fetch(`/api/batch/${batchId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch batch results');
      }

      const data = await response.json();
      setBatch(data.batch);
      setResults(data.results);
      setSummary(data.summary);
    } catch (error) {
      toast({
        title: 'Failed to load results',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      if (showRefreshLoading) setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchResults();

    // Poll for updates if batch is still running
    const interval = setInterval(() => {
      if (batch?.status === 'RUNNING' || batch?.status === 'PENDING') {
        fetchResults();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [batchId]);

  const getRankIcon = (rank?: number) => {
    if (!rank) return <Minus className="h-4 w-4 text-muted-foreground" />;
    if (rank === 1) return <Trophy className="h-4 w-4 text-yellow-500" />;
    if (rank === 2) return <Trophy className="h-4 w-4 text-gray-400" />;
    if (rank === 3) return <Trophy className="h-4 w-4 text-amber-600" />;
    return <span className="text-sm font-medium">#{rank}</span>;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      COMPLETED: 'default',
      FAILED: 'destructive',
      TIMEOUT: 'destructive',
      PARTIAL: 'secondary',
      RUNNING: 'outline',
      PENDING: 'secondary',
    };
    return <Badge variant={variants[status] || 'secondary'}>{status}</Badge>;
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const exportResults = async () => {
    try {
      const response = await fetch(`/api/batch/${batchId}/export`);
      if (!response.ok) throw new Error('Failed to export results');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `batch-${batchId}-results.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast({
        title: 'Export successful',
        description: 'Results have been downloaded.',
      });
    } catch (error) {
      toast({
        title: 'Export failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Group results by benchmark
  const resultsByBenchmark = results.reduce((acc, result) => {
    if (!acc[result.benchmarkId]) {
      acc[result.benchmarkId] = [];
    }
    acc[result.benchmarkId].push(result);
    return acc;
  }, {} as Record<string, BatchResult[]>);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Batch Results</h2>
          <p className="text-muted-foreground">
            {batch?.name || `Batch ${batchId.slice(0, 8)}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => fetchResults(true)} disabled={refreshing}>
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
          <Button variant="outline" onClick={exportResults}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{summary.totalRuns}</div>
              <p className="text-xs text-muted-foreground">Total Runs</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-600">
                {summary.completedRuns}
              </div>
              <p className="text-xs text-muted-foreground">Completed</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-red-600">
                {summary.failedRuns}
              </div>
              <p className="text-xs text-muted-foreground">Failed</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">
                {summary.avgScore?.toFixed(1) ?? '-'}
              </div>
              <p className="text-xs text-muted-foreground">Avg Score</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Progress for running batches */}
      {batch?.status === 'RUNNING' && summary && (
        <Alert>
          <Loader2 className="h-4 w-4 animate-spin" />
          <AlertDescription>
            Batch is running... {summary.completedRuns} of {summary.totalRuns} runs
            completed ({summary.totalRuns > 0 ? ((summary.completedRuns / summary.totalRuns) * 100).toFixed(0) : 0}%)
          </AlertDescription>
        </Alert>
      )}

      {/* Model Comparison */}
      {summary && summary.modelComparison.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Model Rankings</CardTitle>
            <CardDescription>Overall performance across all benchmarks</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Rank</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead className="text-right">Avg Score</TableHead>
                  <TableHead className="text-right">Min</TableHead>
                  <TableHead className="text-right">Max</TableHead>
                  <TableHead className="text-right">Runs</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.modelComparison.map((model) => (
                  <TableRow key={model.modelId}>
                    <TableCell>{getRankIcon(model.rank)}</TableCell>
                    <TableCell className="font-medium">{model.modelName}</TableCell>
                    <TableCell className="text-right">
                      <span className="font-bold">{model.avgScore.toFixed(1)}</span>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {model.minScore.toFixed(1)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {model.maxScore.toFixed(1)}
                    </TableCell>
                    <TableCell className="text-right">{model.runCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Detailed Results by Benchmark */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Detailed Results</h3>
        {Object.entries(resultsByBenchmark).map(([benchmarkId, benchmarkResults]) => (
          <Card key={benchmarkId}>
            <CardHeader>
              <CardTitle className="text-base">
                {benchmarkResults[0].benchmarkName}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Model</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                    <TableHead className="text-right">Tokens</TableHead>
                    <TableHead className="text-right">Duration</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {benchmarkResults
                    .sort((a, b) => (b.score || 0) - (a.score || 0))
                    .map((result) => (
                      <TableRow key={result.modelId}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {getRankIcon(result.rank)}
                            {result.modelName}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {result.score !== undefined && result.score !== null ? (
                            <span className="font-bold">{result.score.toFixed(1)}</span>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {result.tokensUsed?.toLocaleString() ?? '-'}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatDuration(result.duration)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {result.cost ? `$${result.cost.toFixed(4)}` : '-'}
                        </TableCell>
                        <TableCell>{getStatusBadge(result.status)}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
