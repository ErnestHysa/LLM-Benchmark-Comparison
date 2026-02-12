/**
 * Real-Time Batch Progress
 *
 * Shows live batch execution progress with queue and current status
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Loader2, Clock, Play, Hourglass } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface QueuedModel {
  modelId: string;
  modelName: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress?: number;
  benchmarkName?: string;
}

interface BatchProgressProps {
  batchId: string;
  onComplete?: () => void;
  onError?: (error: string) => void;
}

interface ProgressEvent {
  benchmarkRunId: string;
  stepName: string;
  stepNumber: number;
  totalSteps: number;
  percentage: number;
  status: string;
  message?: string;
  currentBenchmark?: string;
  currentModel?: string;
}

export function BatchProgress({ batchId, onComplete, onError }: BatchProgressProps) {
  const { toast } = useToast();

  const [progress, setProgress] = useState<ProgressEvent>({
    benchmarkRunId: batchId,
    stepName: 'Initializing',
    stepNumber: 0,
    totalSteps: 1,
    percentage: 0,
    status: 'pending',
    message: 'Connecting to batch progress stream...',
  });

  const [queue, setQueue] = useState<QueuedModel[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [currentBenchmark, setCurrentBenchmark] = useState<string>('');
  const [currentModel, setCurrentModel] = useState<string>('');

  // Parse message to extract queue info
  const parseQueueFromMessage = useCallback((message: string) => {
    // Format: "0 out of 20" or "Running benchmark X > model Y 5%"
    const parts = message.split(' out of ');
    if (parts.length >= 2) {
      const total = parseInt(parts[0].trim(), 10);
      return { total, completed: 0 }; // Will update from progress percentage
    }
    return null;
  }, []);

  useEffect(() => {
    // Connect to SSE
    const eventSource = new EventSource(`/api/batch/${batchId}/progress`);

    eventSource.addEventListener('progress', (e) => {
      const data: ProgressEvent = JSON.parse(e.data);
      setProgress(data);

      // Update current benchmark/model
      if (data.currentBenchmark) {
        setCurrentBenchmark(data.currentBenchmark);
      }
      if (data.currentModel) {
        setCurrentModel(data.currentModel);
      }

      // Parse and update queue
      const queueInfo = parseQueueFromMessage(data.message || '');
      if (queueInfo) {
        setQueue((prev) => {
          // Create queue array if needed
          if (prev.length !== queueInfo.total) {
            const benchmarks = progress.currentBenchmark || prev.map(q => q.benchmarkName).filter(Boolean);
            const uniqueBenchmarks = [...new Set(benchmarks)];
            const models = queue.length > 0 ? queue[0].map(q => q.modelName) : [];

            return uniqueBenchmarks.flatMap(bench =>
              models.map(model => ({
                modelId: model,
                modelName: model,
                status: 'pending',
              }))
            );
          }

          // Update status of current run based on percentage
          return prev.map(q => {
            if (data.currentBenchmark && data.currentModel) {
              const isCurrentRun = q.benchmarkName === data.currentBenchmark && q.modelName === data.currentModel;
              if (isCurrentRun) {
                return { ...q, progress: data.percentage };
              }
            }
            return q;
          });
        });
      }
    });

    eventSource.addEventListener('complete', (e) => {
      const data = JSON.parse(e.data);
      setIsComplete(true);
      if (data.success) {
        toast({ title: 'Batch completed', description: 'All runs have finished.' });
        onComplete?.();
      } else {
        const errorMsg = data.error || 'Batch failed to complete';
        onError?.(errorMsg);
        toast({ title: 'Batch failed', description: errorMsg, variant: 'destructive' });
      }
      eventSource.close();
    });

    eventSource.addEventListener('error', (e) => {
      const data = JSON.parse(e.data);
      setIsComplete(true);
      onError?.(data.message || 'Unknown error');
      toast({ title: 'Batch error', description: data.message || 'Unknown error', variant: 'destructive' });
      eventSource.close();
    });

    return () => {
      eventSource.close();
    };
  }, [batchId, parseQueueFromMessage]);

  // Calculate queue stats
  const totalQueued = queue.length;
  const completedQueued = queue.filter(q => q.status === 'completed').length;
  const runningQueued = queue.filter(q => q.status === 'running').length;
  const failedQueued = queue.filter(q => q.status === 'failed').length;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Hourglass className="h-4 w-4 text-muted-foreground" />;
      case 'running':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  // Get models grouped by benchmark for queue display
  const queueByBenchmark = queue.reduce((acc, item) => {
    if (!acc[item.benchmarkName || '']) {
      acc[item.benchmarkName || ''] = [];
    }
    acc[item.benchmarkName || '']?.push(item);
    return acc;
  }, {} as Record<string, QueuedModel[]>);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            {progress.status === 'running' ? (
              <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
            ) : isComplete ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : (
              <Clock className="h-5 w-5 text-muted-foreground" />
            )}
            {progress.stepName || 'Batch Progress'}
          </CardTitle>
          <Badge variant={progress.status === 'running' ? 'default' : progress.status === 'completed' ? 'secondary' : 'destructive'}>
            {progress.percentage.toFixed(0)}%
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Progress */}
        <div>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-muted-foreground">Overall Progress</span>
            <span className="font-medium">
              {progress.completedRuns || progress.stepNumber} / {progress.totalSteps || progress.totalSteps || 1}
            </span>
          </div>
          <Progress value={progress.percentage} />
        </div>

        {/* Current Status */}
        <div className="bg-muted/50 p-3 rounded-lg border">
          {progress.status === 'running' && currentBenchmark && currentModel ? (
            <div className="flex items-center gap-2">
              <Play className="h-4 w-4 text-blue-500" />
              <span className="text-sm">
                <span className="font-medium">{currentBenchmark}</span>
                <span className="text-muted-foreground"> running against </span>
                <span className="font-medium">{currentModel}</span>
              </span>
              <span className="text-muted-foreground text-xs ml-2">
                {queue.filter(q => q.status === 'running').length > 1
                  ? `+${queue.filter(q => q.status === 'running').length - 1} more`
                  : '(1 of 1)'}
              </span>
            </div>
          ) : progress.status === 'completed' ? (
            <div className="text-sm text-green-600">
              Batch completed successfully!
            </div>
          ) : progress.status === 'PENDING' ? (
            <div className="text-sm text-muted-foreground">
              Initializing batch execution...
            </div>
          ) : (
            <div className="text-sm text-red-600">
              {progress.message || 'An error occurred'}
            </div>
          )}
        </div>

        {/* Queue Display */}
        {queue.length > 0 && progress.status === 'running' && (
          <div>
            <h4 className="text-sm font-semibold mb-2 flex items-center justify-between">
              <span>Execution Queue</span>
              <span className="text-xs text-muted-foreground">
                {totalQueued} total · {completedQueued} completed · {runningQueued} running · {failedQueued} failed
              </span>
            </h4>

            <div className="space-y-2">
              {Object.entries(queueByBenchmark)
                .filter(([_, items]) => items.length > 0)
                .sort(([a], [b]) => a.localeCompare(b))
                .slice(0, 3) // Show first 3 benchmarks
                .map(([benchmarkName, items]) => (
                  <div key={benchmarkName} className="border rounded-lg p-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">{benchmarkName || 'Unknown'}</span>
                      <Badge variant="outline" className="text-xs">
                        {items.length} model{items.length !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-4 gap-1 text-xs">
                      {items.map((item, idx) => (
                        <div
                          key={item.modelId}
                          className={`
                            flex items-center gap-1 p-1.5 rounded border
                            ${item.status === 'running' ? 'border-blue-500 bg-blue-50' : ''}
                            ${item.status === 'completed' ? 'border-green-500 bg-green-50' : ''}
                            ${item.status === 'failed' ? 'border-red-500 bg-red-50' : ''}
                          `}
                        >
                          {getStatusIcon(item.status)}
                          <span className="truncate" title={item.modelName}>{item.modelName}</span>
                          {item.status === 'running' && item.progress !== undefined && (
                            <span className="ml-auto text-xs text-muted-foreground">
                              {item.progress}%
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Progress Message */}
        {progress.message && progress.status !== 'completed' && (
          <div className="text-sm text-muted-foreground italic">
            {progress.message}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
