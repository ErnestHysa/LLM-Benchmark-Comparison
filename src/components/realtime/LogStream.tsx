/**
 * Log Stream Component
 *
 * Displays a scrolling log view for benchmark runs.
 * Can be used standalone or embedded in other components.
 */

'use client';

import { useEffect, useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Info, AlertTriangle, AlertCircle, Bug } from 'lucide-react';

/**
 * Log entry structure
 */
export interface LogEntry {
  level: 'info' | 'warning' | 'error' | 'debug';
  message: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

interface LogStreamProps {
  benchmarkRunId: string;
  maxEntries?: number;
  className?: string;
  showLevel?: boolean;
  autoScroll?: boolean;
}

/**
 * Level icon and color mapping
 */
const LEVEL_CONFIG = {
  info: {
    icon: Info,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    label: 'INFO',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
    label: 'WARN',
  },
  error: {
    icon: AlertCircle,
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    label: 'ERROR',
  },
  debug: {
    icon: Bug,
    color: 'text-gray-500',
    bgColor: 'bg-gray-500/10',
    label: 'DEBUG',
  },
} as const;

/**
 * Main Log Stream Component
 */
export function LogStream({
  benchmarkRunId,
  maxEntries = 50,
  className,
  showLevel = true,
  autoScroll = true,
}: LogStreamProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    console.log(`[LogStream] Connecting to SSE for run: ${benchmarkRunId}`);

    const eventSource = new EventSource(`/api/benchmark-runs/${benchmarkRunId}/progress`);
    eventSourceRef.current = eventSource;

    eventSource.addEventListener('open', () => {
      setIsConnected(true);
    });

    eventSource.addEventListener('error', () => {
      setIsConnected(false);
    });

    // Listen for log events only
    eventSource.addEventListener('log', (event) => {
      try {
        const data = JSON.parse(event.data);
        setLogs((prev) => {
          const newLogs = [...prev, data];
          // Keep only the most recent entries
          return maxEntries > 0 ? newLogs.slice(-maxEntries) : newLogs;
        });
      } catch (error) {
        console.error('[LogStream] Error parsing log event:', error);
      }
    });

    // Also listen for completion to close connection
    eventSource.addEventListener('complete', () => {
      setTimeout(() => {
        eventSource.close();
        setIsConnected(false);
      }, 1000);
    });

    return () => {
      eventSource.close();
    };
  }, [benchmarkRunId, maxEntries]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && scrollRef.current && logs.length > 0) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs.length, autoScroll]);

  const lastLogLevel = logs[logs.length - 1]?.level ?? 'info';
  const Config = LEVEL_CONFIG[lastLogLevel] ?? LEVEL_CONFIG.info;

  return (
    <div className={cn('relative', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium">Live Logs</h3>
          {showLevel && (
            <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
              {logs.length} entries
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className={cn(
            'h-2 w-2 rounded-full',
            isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
          )} />
          <span className="text-xs text-muted-foreground">
            {isConnected ? 'Live' : 'Offline'}
          </span>
        </div>
      </div>

      {/* Log entries */}
      <div
        ref={scrollRef}
        className={cn(
          'h-64 overflow-y-auto font-mono text-xs bg-muted rounded-lg p-3 space-y-1',
          'scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-muted'
        )}
      >
        {logs.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Config.icon className="h-8 w-8 mb-2 opacity-50" />
            <p>Waiting for log entries...</p>
          </div>
        )}

        {logs.map((log, index) => {
          const config = LEVEL_CONFIG[log.level];
          return (
            <div
              key={index}
              className={cn(
                'py-0.5 px-2 rounded -mx-2',
                config.bgColor,
                config.color
              )}
            >
              <div className="flex items-start gap-2">
                {showLevel && (
                  <span className="flex-shrink-0 font-semibold">
                    [{config.label}]
                  </span>
                )}
                <span className="text-muted-foreground/60 mr-2">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <span className="flex-1 break-words">
                  {log.message}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty state indicator */}
      {logs.length === 0 && !isConnected && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-lg">
          <p className="text-sm text-muted-foreground">
            Log stream not available. The run may have completed or not started yet.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Filterable log stream component
 */
interface FilterableLogStreamProps extends LogStreamProps {
  filters?: ('info' | 'warning' | 'error' | 'debug')[];
  onFilterChange?: (filters: string[]) => void;
}

export function FilterableLogStream({
  filters,
  onFilterChange,
  ...props
}: FilterableLogStreamProps) {
  const [activeFilters, setActiveFilters] = useState<string[]>(
    filters || ['info', 'warning', 'error', 'debug']
  );

  const handleToggleFilter = (level: string) => {
    const newFilters = activeFilters.includes(level)
      ? activeFilters.filter((f) => f !== level)
      : [...activeFilters, level];

    setActiveFilters(newFilters);
    onFilterChange?.(newFilters);
  };

  return (
    <div className="space-y-3">
      {/* Filter buttons */}
      <div className="flex flex-wrap gap-2">
        {(['info', 'warning', 'error', 'debug'] as const).map((level) => {
          const config = LEVEL_CONFIG[level as keyof typeof LEVEL_CONFIG];
          const isActive = activeFilters.includes(level);
          return (
            <button
              key={level}
              onClick={() => handleToggleFilter(level)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                'border',
                isActive
                  ? `${config.color} bg-${config.color}/10 border-${config.color}/30`
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              <config.icon className="h-3 w-3" />
              {config.label}
            </button>
          );
        })}
      </div>

      {/* Pass through to main component, but could filter logs here */}
      <LogStream {...props} />
    </div>
  );
}
