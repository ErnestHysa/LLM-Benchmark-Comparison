/**
 * Real-time ProgressBar Component
 *
 * Displays live progress updates during benchmark execution using Server-Sent Events.
 * Shows current step, percentage, and live log stream.
 */

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Progress data received from SSE
 */
export interface ProgressData {
  stepName: string;
  stepNumber: number;
  totalSteps: number;
  percentage: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  message?: string;
}

/**
 * Log entry received from SSE
 */
export interface LogEntry {
  level: 'info' | 'warning' | 'error' | 'debug';
  message: string;
  timestamp: string;
}

/**
 * Props for the ProgressBar component
 */
interface ProgressBarProps {
  benchmarkRunId: string;
  onComplete?: (results: unknown) => void;
  onError?: (error: string) => void;
  onProgressChange?: (progress: ProgressData) => void;
  compact?: boolean;  // Compact mode for inline display
}

/**
 * Status icon configuration
 */
const STATUS_ICONS = {
  pending: <Loader2 className="h-5 w-5 animate-spin text-yellow-500" />,
  running: <Loader2 className="h-5 w-5 animate-spin text-blue-500" />,
  completed: <CheckCircle2 className="h-5 w-5 text-green-500" />,
  failed: <XCircle className="h-5 w-5 text-red-500" />,
} as const;

/**
 * Status badge variants
 */
function getStatusBadgeVariant(status: ProgressData['status']): 'default' | 'destructive' | 'secondary' {
  if (status === 'failed') return 'destructive';
  if (status === 'completed') return 'default';
  return 'secondary';
}

/**
 * Main ProgressBar Component
 */
export function ProgressBar({
  benchmarkRunId,
  onComplete,
  onError,
  onProgressChange,
  compact = false,
}: ProgressBarProps) {
  const [progress, setProgress] = useState<ProgressData>({
    stepName: 'Initializing...',
    stepNumber: 0,
    totalSteps: 1,
    percentage: 0,
    status: 'pending',
  });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [hasError, setHasError] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY = 2000;

  /**
   * Process SSE message based on event type
   */
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);

      switch (event.type) {
        case 'progress':
          setProgress(data);
          onProgressChange?.(data);
          break;

        case 'log':
          setLogs((prev) => [...prev, data]);
          break;

        case 'complete':
          setProgress((prev) => ({
            ...prev,
            status: data.success ? 'completed' : 'failed',
            percentage: 100,
          }));
          if (data.success) {
            onComplete?.(data.results);
          } else {
            onError?.(data.error || 'Benchmark completed with errors');
          }
          // Close connection after completion
          cleanup();
          break;

        case 'error':
          setProgress((prev) => ({
            ...prev,
            status: 'failed',
            message: data.message || 'An error occurred',
          }));
          setHasError(true);
          onError?.(data.message || 'An error occurred');
          cleanup();
          break;

        default:
          console.warn('[ProgressBar] Unknown event type:', event.type);
      }
    } catch (error) {
      console.error('[ProgressBar] Error parsing SSE message:', error);
    }
  }, [onComplete, onError, onProgressChange]);

  /**
   * Setup EventSource connection
   */
  const setupConnection = useCallback(() => {
    // Clean up any existing connection
    cleanup();

    console.log(`[ProgressBar] Connecting to SSE for run: ${benchmarkRunId}`);

    const eventSource = new EventSource(`/api/benchmark-runs/${benchmarkRunId}/progress`);
    eventSourceRef.current = eventSource;

    // Connection opened
    eventSource.addEventListener('open', () => {
      console.log('[ProgressBar] SSE connection opened');
      setIsConnected(true);
      setHasError(false);
      reconnectAttemptsRef.current = 0;
    });

    // Connection error
    eventSource.addEventListener('error', (error) => {
      console.error('[ProgressBar] SSE connection error:', error);
      setIsConnected(false);

      // Attempt to reconnect
      if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttemptsRef.current++;
        console.log(`[ProgressBar] Scheduling reconnect attempt ${reconnectAttemptsRef.current + 1}`);
        reconnectTimeoutRef.current = setTimeout(() => {
          setupConnection();
        }, RECONNECT_DELAY);
      } else {
        setHasError(true);
        setProgress((prev: ProgressData) => ({
          ...prev,
          status: 'failed',
          message: 'Connection lost. Please refresh the page.',
        }));
      }
    });

    // Listen for all event types
    eventSource.addEventListener('progress', handleMessage as EventListener);
    eventSource.addEventListener('log', handleMessage as EventListener);
    eventSource.addEventListener('complete', handleMessage as EventListener);
    eventSource.addEventListener('error', handleMessage as EventListener);
  }, [benchmarkRunId, handleMessage]);

  /**
   * Clean up EventSource connection
   */
  const cleanup = useCallback(() => {
    console.log('[ProgressBar] Cleaning up SSE connection');

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setIsConnected(false);
  }, []);

  /**
   * Setup connection on mount and handle cleanup
   */
  useEffect(() => {
    setupConnection();

    return () => {
      cleanup();
    };
  }, [setupConnection, cleanup]);

  /**
   * Get status icon based on current status
   */
  const statusIcon = STATUS_ICONS[progress.status] || STATUS_ICONS.pending;

  /**
   * Display logs (last N entries in compact mode, all in full mode)
   */
  const displayLogs = compact ? logs.slice(-5) : logs;

  /**
   * Compact mode rendering
   */
  if (compact) {
    return (
      <div className="space-y-2">
        {/* Progress bar with status */}
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <Progress value={progress.percentage} className="h-2" />
          </div>
          <span className="text-sm text-muted-foreground min-w-12 text-right">
            {progress.percentage.toFixed(0)}%
          </span>
          {statusIcon}
        </div>
        {/* Current step */}
        {progress.stepName && (
          <p className="text-sm text-muted-foreground truncate">
            {progress.stepName}
            {progress.message && ` - ${progress.message}`}
          </p>
        )}
      </div>
    );
  }

  /**
   * Full card rendering
   */
  return (
    <Card className={cn(
      'border-2',
      hasError && 'border-destructive/50',
      progress.status === 'completed' && 'border-green-500/50'
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            {statusIcon}
            <span className="truncate">{progress.stepName}</span>
          </CardTitle>
          <Badge
            variant={getStatusBadgeVariant(progress.status)}
            className={cn(
              'whitespace-nowrap',
              progress.status === 'running' && 'animate-pulse'
            )}
          >
            {progress.percentage.toFixed(0)}%
          </Badge>
        </div>

        {/* Connection status indicator */}
        <div className="flex items-center gap-2">
          <div className={cn(
            'h-2 w-2 rounded-full',
            isConnected ? 'bg-green-500' : 'bg-gray-400'
          )} />
          <span className="text-xs text-muted-foreground">
            {isConnected ? 'Live' : 'Connecting...'}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Progress bar */}
        <Progress
          value={progress.percentage}
          className="h-3"
        />

        {/* Step info */}
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            Step {progress.stepNumber} of {progress.totalSteps}
          </span>
          {progress.message && (
            <span className="text-muted-foreground">
              {progress.message}
            </span>
          )}
        </div>

        {/* Log stream */}
        {logs.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Live Logs</span>
              <span className="text-xs text-muted-foreground">
                Last {displayLogs.length} entries
              </span>
            </div>
            <div className={cn(
              'max-h-48 overflow-y-auto font-mono text-xs bg-muted rounded-lg p-3 space-y-1',
              'scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-muted'
            )}>
              {displayLogs.map((log, index) => {
                const fullIndex = logs.length - displayLogs.length + index;
                return (
                  <div
                    key={fullIndex}
                    className={cn(
                      'py-0.5',
                      log.level === 'error' && 'text-red-500 font-semibold',
                      log.level === 'warning' && 'text-yellow-500',
                      log.level === 'info' && 'text-blue-400',
                      log.level === 'debug' && 'text-gray-500'
                    )}
                  >
                    <span className="text-muted-foreground/60 mr-2">
                      [{new Date(log.timestamp).toLocaleTimeString()}]
                    </span>
                    {log.message}
                  </div>
                );
              })}
              {logs.length === 0 && (
                <div className="text-muted-foreground text-center py-4">
                  Waiting for logs...
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error message display */}
        {hasError && (
          <div className="mt-4 p-3 bg-destructive/10 rounded-lg border border-destructive/20">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-destructive">Connection Lost</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Unable to connect to the progress stream. The benchmark may still be running.
                  Please refresh the page to reconnect.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Export a simplified compact version for use in other components
 */
export function CompactProgressBar(props: Omit<ProgressBarProps, 'compact'>) {
  return <ProgressBar {...props} compact />;
}
