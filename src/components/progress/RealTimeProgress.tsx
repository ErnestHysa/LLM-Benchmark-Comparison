/**
 * Shared Real-Time Progress Component
 *
 * Unified progress display for both single benchmark runs and batch operations
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Loader2, Play, Hourglass, Cpu, Activity } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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

interface QueuedModel {
  modelId: string;
  modelName: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress?: number;
  benchmarkName?: string;
}

interface RealTimeProgressProps {
  benchmarkRunId: string;
  onComplete?: () => void;
  onError?: (error: string) => void;
  showLinkToBatch?: boolean;
}

/**
 * Parse message to extract queue info from various formats
 * Supports: "0 out of 20", "Running benchmark X > model Y 5%", etc.
 */
function parseQueueFromMessage(
  message: string | undefined,
  currentStep: number,
  totalSteps: number,
  currentBenchmark?: string,
  currentModel?: string
): {
  total: number;
  completed: number;
  queue: QueuedModel[];
  currentIndex: number;
} {
  // Format: "0 out of 20" or "0.0% out of 20"
  const outOfMatch = message?.match(/(\d+(?:\.\d+)?%?)?\s*out of\s+(\d+)/);
  if (outOfMatch) {
    const completed = parseInt(outOfMatch[1].replace('%', ''), 10);
    const total = parseInt(outOfMatch[2].replace('%', ''), 10);
    return {
      total,
      completed,
      queue: [],
      currentIndex: completed,
    };
  }

  // Format: "Running benchmark X > model Y 5%"
  const runningMatch = message?.match(/Running\s+(.+?)\s*>\s*model\s+(\S+)\s+(\d+(?:\.\d+)?%?)/);
  if (runningMatch && currentBenchmark && currentModel) {
    const percentage = parseFloat(runningMatch[3].replace('%', ''));
    const total = 100;
    const completed = Math.round(percentage);
    const currentIndex = completed;

    // Estimate remaining from percentage
    const remaining = Math.max(0, Math.round((100 - percentage) / (100 / totalSteps)));

    // Build queue showing current + remaining
    const queue: QueuedModel[] = [
      {
        modelId: currentModel,
        modelName: currentModel,
        benchmarkName: currentBenchmark,
        status: 'running',
        progress: percentage,
      },
      {
        modelId: 'remaining',
        modelName: `${remaining} more`,
        benchmarkName: currentBenchmark,
        status: 'pending',
      },
    ];

    return { total, completed, queue, currentIndex };
  }

  // Default: return basic info from progress percentage
  const percentage = currentStep > 0 && totalSteps > 0
    ? (currentStep / totalSteps) * 100
    : 0;

  return {
    total: totalSteps,
    completed: currentStep,
    queue: [],
    currentIndex: currentStep,
  };
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending':
      return 'text-yellow-600';
    case 'running':
      return 'text-blue-600';
    case 'completed':
      return 'text-green-600';
    case 'failed':
      return 'text-red-600';
    default:
      return 'text-muted-foreground';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'pending':
      return <Hourglass className="h-4 w-4" />;
    case 'running':
      return <Loader2 className="h-4 w-4 animate-spin" />;
    case 'completed':
      return <CheckCircle2 className="h-4 w-4" />;
    case 'failed':
      return <XCircle className="h-4 w-4" />;
    default:
      return <Activity className="h-4 w-4" />;
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'pending':
      return 'Waiting';
    case 'running':
      return 'Running';
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Failed';
    default:
      return 'Unknown';
  }
};

export function RealTimeProgress({
  benchmarkRunId,
  onComplete,
  onError,
  showLinkToBatch = false,
}: RealTimeProgressProps) {
  const { toast } = useToast();

  const [progress, setProgress] = useState<ProgressEvent>({
    benchmarkRunId,
    stepName: 'Initializing',
    stepNumber: 0,
    totalSteps: 1,
    percentage: 0,
    status: 'pending',
    message: 'Connecting to progress stream...',
  });

  // Parse queue info from progress
  const [queueState, setQueueState] = useState<{
    total: number;
    completed: number;
    queue: QueuedModel[];
    currentIndex: number;
  }>({
    total: 1,
    completed: 0,
    queue: [],
    currentIndex: 0,
  });

  const [isComplete, setIsComplete] = useState(false);
  const [currentBenchmarkName, setCurrentBenchmarkName] = useState<string>('');
  const [currentModelName, setCurrentModelName] = useState<string>('');

  useEffect(() => {
    const eventSource = new EventSource(`/api/benchmark-progress/${benchmarkRunId}`);

    eventSource.addEventListener('progress', (e) => {
      const data: ProgressEvent = JSON.parse(e.data);
      setProgress(data);

      // Update current names
      if (data.currentBenchmark) {
        setCurrentBenchmarkName(data.currentBenchmark);
      }
      if (data.currentModel) {
        setCurrentModelName(data.currentModel);
      }

      // Parse and update queue
      const parsed = parseQueueFromMessage(
        data.message,
        data.stepNumber,
        data.totalSteps,
        data.currentBenchmark,
        data.currentModel
      );
      setQueueState(parsed);
    });

    eventSource.addEventListener('complete', (e) => {
      const data = JSON.parse(e.data);
      setIsComplete(true);
      if (data.success) {
        toast({ title: 'Benchmark completed', description: 'All runs have finished.' });
        onComplete?.();
      } else {
        const errorMsg = data.error || 'Run failed';
        onError?.(errorMsg);
        toast({ title: 'Benchmark failed', description: errorMsg, variant: 'destructive' });
      }
      eventSource.close();
    });

    eventSource.addEventListener('error', (e) => {
      const data = JSON.parse(e.data);
      setIsComplete(true);
      const errorMsg = data.message || 'Unknown error';
      onError?.(errorMsg);
      toast({ title: 'Benchmark error', description: errorMsg, variant: 'destructive' });
      eventSource.close();
    });

    return () => {
      eventSource.close();
    };
  }, [benchmarkRunId, onComplete, onError]);

  // Calculate queue stats
  const totalQueued = queueState.queue.length;
  const completedQueued = queueState.queue.filter(q => q.status === 'completed').length;
  const runningQueued = queueState.queue.filter(q => q.status === 'running').length;
  const failedQueued = queueState.queue.filter(q => q.status === 'failed').length;
  const pendingQueued = queueState.queue.filter(q => q.status === 'pending').length;

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {progress.status === 'running' ? (
              <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
            ) : isComplete ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : progress.status === 'PENDING' ? (
              <Hourglass className="h-5 w-5 text-yellow-600" />
            ) : (
              <Activity className="h-5 w-5 text-muted-foreground" />
            )}
            <span className="font-semibold">
              {progress.stepName || 'Progress'}
            </span>
            {showLinkToBatch && progress.benchmarkRunId && (
              <a
                href={`/batch?tab=progress#${progress.benchmarkRunId}`}
                className="ml-2 text-sm text-blue-500 hover:underline"
                onClick={(e) => {
                  e.stopPropagation();
                }}
              >
                (View Batch Progress)
              </a>
            )}
          </div>
          <Badge variant={progress.status === 'running' ? 'default' : progress.status === 'completed' ? 'secondary' : 'destructive'}>
            {progress.percentage.toFixed(0)}%
          </Badge>
        </div>
        {currentBenchmarkName && currentModelName && (
          <div className="text-sm text-muted-foreground">
            Running: <span className="font-medium">{currentBenchmarkName}</span>
            {' '}
            against <span className="font-medium">{currentModelName}</span>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Progress */}
        <div>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-muted-foreground">Overall Progress</span>
            <span className="font-medium">
              {queueState.completed} / {queueState.total || 1}
            </span>
          </div>
          <Progress value={progress.percentage} />
        </div>

        {/* Queue Display */}
        {queueState.queue.length > 0 && progress.status === 'running' && (
          <div className="border rounded-lg p-3 bg-muted/30">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold">Execution Queue</h4>
              <span className="text-xs text-muted-foreground">
                {queueState.total} total · {queueState.completed} completed · {runningQueued} running · {failedQueued} failed
              </span>
            </div>

            {/* Current Step indicator */}
            <div className="text-xs text-muted-foreground mb-2">
              {progress.stepNumber !== undefined && queueState.total > 0 && (
                <span>Step {progress.stepNumber} of {queueState.total}</span>
              )}
            </div>

            {/* Queue Items - Group by benchmark for clarity */}
            <div className="space-y-2">
              {queueState.queue
                .filter((q, index, arr) => arr.findIndex(item => item.modelId !== 'remaining') === index)
                .slice(0, 6) // Show first 6 items
                .map((item) => (
                  <div
                    key={item.modelId}
                    className={`
                      flex items-center gap-2 p-2 rounded border
                      ${item.status === 'running' ? 'border-blue-500 bg-blue-50' : ''}
                      ${item.status === 'completed' ? 'border-green-500 bg-green-50' : ''}
                      ${item.status === 'failed' ? 'border-red-500 bg-red-50' : ''}
                    `}
                  >
                    <div className="flex items-center flex-1 min-w-0">
                      {getStatusIcon(item.status)}
                      <span
                        className={item.modelId === 'remaining' ? 'text-xs text-muted-foreground italic' : 'truncate'}
                        style={item.modelId === 'remaining' ? { maxWidth: '150px' } : {}}
                        title={item.modelName}
                      >
                        {item.benchmarkName && item.modelId !== 'remaining' && (
                          <span className="text-xs text-muted-foreground">{item.benchmarkName} » </span>
                        )}
                        {item.modelName}
                      </span>
                      {item.status === 'running' && item.progress !== undefined && (
                        <span className="ml-auto text-xs text-muted-foreground">
                          {item.progress}%
                        </span>
                      )}
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

        {/* Completion Message */}
        {isComplete && progress.status === 'completed' && (
          <div className="text-sm text-green-600">
            Benchmark completed successfully!
          </div>
        )}

        {/* Error Message */}
        {isComplete && progress.status === 'FAILED' && (
          <div className="text-sm text-red-600">
            {progress.message || 'An error occurred'}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
