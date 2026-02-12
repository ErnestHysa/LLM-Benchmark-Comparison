/**
 * useBenchmarkProgress Hook
 *
 * React hook for managing real-time benchmark progress via SSE.
 * Handles connection, reconnection, and state management automatically.
 */

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import type { ProgressData, LogEntry } from '@/components/realtime';

/**
 * Hook state returned to components
 */
export interface UseBenchmarkProgressState {
  progress: ProgressData;
  logs: LogEntry[];
  isConnected: boolean;
  hasError: boolean;
  isComplete: boolean;
  reconnect: () => void;
  clearLogs: () => void;
}

/**
 * Hook options
 */
export interface UseBenchmarkProgressOptions {
  enabled?: boolean;  // Enable/disable the connection
  onProgress?: (progress: ProgressData) => void;
  onLog?: (log: LogEntry) => void;
  onComplete?: (success: boolean, results?: unknown, error?: string) => void;
  onError?: (error: string) => void;
  maxLogs?: number;  // Maximum number of logs to keep in memory
}

/**
 * Main hook for benchmark progress
 */
export function useBenchmarkProgress(
  benchmarkRunId: string | null,
  options: UseBenchmarkProgressOptions = {}
): UseBenchmarkProgressState {
  const {
    enabled = true,
    onProgress,
    onLog,
    onComplete,
    onError,
    maxLogs = 100,
  } = options;

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
  const [isComplete, setIsComplete] = useState(false);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const receivedMessagesRef = useRef<Set<string>>(new Set());

  const MAX_RECONNECT_ATTEMPTS = 10;
  const INITIAL_RECONNECT_DELAY = 1000;
  const MAX_RECONNECT_DELAY = 10000;

  /**
   * Calculate exponential backoff delay for reconnection
   */
  const getReconnectDelay = useCallback((): number => {
    const delay = INITIAL_RECONNECT_DELAY * Math.pow(1.5, reconnectAttemptsRef.current);
    return Math.min(delay, MAX_RECONNECT_DELAY);
  }, []);

  /**
   * Process SSE message
   */
  const handleMessage = useCallback((event: MessageEvent) => {
    const messageId = `${event.type}-${event.timeStamp}`;

    // Skip duplicate messages
    if (receivedMessagesRef.current.has(messageId)) {
      return;
    }
    receivedMessagesRef.current.add(messageId);

    // Clean up old message IDs to prevent memory leak
    if (receivedMessagesRef.current.size > 1000) {
      const entries = Array.from(receivedMessagesRef.current);
      receivedMessagesRef.current = new Set(entries.slice(-500));
    }

    try {
      const data = JSON.parse(event.data);

      switch (event.type) {
        case 'progress': {
          setProgress(data);
          onProgress?.(data);
          break;
        }

        case 'log': {
          setLogs((prev) => {
            const newLogs = [...prev, data];
            return maxLogs > 0 ? newLogs.slice(-maxLogs) : newLogs;
          });
          onLog?.(data);
          break;
        }

        case 'complete': {
          const success = data.success !== false;
          setIsComplete(true);
          setProgress((prev: ProgressData) => ({
            ...prev,
            status: success ? 'completed' : 'failed',
            percentage: 100,
          }));

          onComplete?.(success, data.results, data.error);
          cleanup();
          break;
        }

        case 'error': {
          setHasError(true);
          setProgress((prev: ProgressData) => ({
            ...prev,
            status: 'failed',
            message: data.message || 'An error occurred',
          }));

          onError?.(data.message || 'An error occurred');
          cleanup();
          break;
        }

        default:
          console.warn('[useBenchmarkProgress] Unknown event type:', event.type);
      }
    } catch (err) {
      console.error('[useBenchmarkProgress] Error parsing SSE message:', err);
    }
  }, [onProgress, onLog, onComplete, onError, maxLogs]);

  /**
   * Setup EventSource connection
   */
  const setupConnection = useCallback(() => {
    if (!benchmarkRunId || !enabled) {
      return;
    }

    // Don't reconnect if already connected to same run
    if (eventSourceRef.current?.url?.includes(benchmarkRunId)) {
      return;
    }

    cleanup();

    console.log(`[useBenchmarkProgress] Connecting to SSE for run: ${benchmarkRunId}`);

    try {
      const eventSource = new EventSource(`/api/benchmark-runs/${benchmarkRunId}/progress`);
      eventSourceRef.current = eventSource;

      // Connection opened
      eventSource.addEventListener('open', () => {
        console.log('[useBenchmarkProgress] SSE connection opened');
        setIsConnected(true);
        setHasError(false);
        reconnectAttemptsRef.current = 0;

        // Request initial progress state
        eventSource.addEventListener('message', () => {
          // This will catch any cached messages
        });
      });

      // Connection error
      eventSource.addEventListener('error', () => {
        console.error('[useBenchmarkProgress] SSE connection error');
        setIsConnected(false);

        // Attempt to reconnect with backoff
        if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS && enabled) {
          reconnectAttemptsRef.current++;
          const delay = getReconnectDelay();

          console.log(
            `[useBenchmarkProgress] Scheduling reconnect attempt ${reconnectAttemptsRef.current + 1} in ${delay}ms`
          );

          reconnectTimeoutRef.current = setTimeout(() => {
            setupConnection();
          }, delay);
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

    } catch (error) {
      console.error('[useBenchmarkProgress] Failed to create EventSource:', error);
      setHasError(true);
    }
  }, [benchmarkRunId, enabled, handleMessage, getReconnectDelay]);

  /**
   * Clean up EventSource connection
   */
  const cleanup = useCallback(() => {
    console.log('[useBenchmarkProgress] Cleaning up SSE connection');

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setIsConnected(false);
    receivedMessagesRef.current.clear();
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
   * Manual reconnection function
   */
  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    cleanup();
    setTimeout(() => {
      setupConnection();
    }, 100);
  }, [cleanup, setupConnection]);

  /**
   * Clear logs
   */
  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  return {
    progress,
    logs,
    isConnected,
    hasError,
    isComplete,
    reconnect,
    clearLogs,
  };
}

/**
 * Simplified hook that only returns progress (no logs)
 */
export function useBenchmarkProgressOnly(
  benchmarkRunId: string | null
): ProgressData | null {
  const [progress, setProgress] = useState<ProgressData | null>(null);

  useEffect(() => {
    if (!benchmarkRunId) {
      setProgress(null);
      return;
    }

    const eventSource = new EventSource(`/api/benchmark-runs/${benchmarkRunId}/progress`);

    eventSource.addEventListener('progress', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        setProgress(data);
      } catch {
        // Ignore parse errors
      }
    });

    eventSource.addEventListener('complete', () => {
      setTimeout(() => {
        eventSource.close();
      }, 1000);
    });

    return () => {
      eventSource.close();
    };
  }, [benchmarkRunId]);

  return progress;
}
