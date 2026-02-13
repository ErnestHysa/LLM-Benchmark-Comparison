/**
 * Server-Sent Events (SSE) Implementation
 *
 * Provides real-time updates for benchmark runs.
 * Simpler than WebSockets for single-user local apps.
 */

export interface SSEMessage {
  event?: string;
  data: unknown;
}

export interface ProgressData {
  benchmarkRunId: string;
  stepName: string;
  stepNumber: number;
  totalSteps: number;
  percentage: number;
  status: "pending" | "running" | "completed" | "failed";
  message?: string;
  metadata?: Record<string, unknown>;
  modelName?: string; // Current model being processed
  modelProvider?: string; // Provider of current model
  currentModelIndex?: number; // Index of current model (0-based)
  totalModels?: number; // Total number of models
  currentBenchmark?: string; // Current benchmark name
  currentModel?: string; // Current model ID
}

export interface LogData {
  benchmarkRunId: string;
  level: "info" | "warning" | "error" | "debug";
  message: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export interface CompleteData {
  benchmarkRunId: string;
  success: boolean;
  results?: unknown;
  error?: string;
}

/**
 * SSE Emitter for a single connection
 * Manages a ReadableStream for Server-Sent Events
 */
export class SSEEmitter {
  private controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  private encoder: TextEncoder = new TextEncoder();

  /**
   * Create a new ReadableStream for this emitter
   */
  getStream(): ReadableStream<Uint8Array> {
    // Clean up any existing controller
    if (this.controller) {
      try {
        this.controller.close();
      } catch {
        // Ignore errors during cleanup
      }
    }

    return new ReadableStream({
      start: (controller) => {
        this.controller = controller;
      },
      cancel: () => {
        this.controller = null;
      },
    });
  }

  /**
   * Emit an SSE-formatted message
   */
  private emit(event: string, data: unknown): void {
    if (!this.controller) {
      console.warn("[SSE] Attempted to emit but no controller available");
      return;
    }

    // Format: "event: name\ndata: JSON\n\n"
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    this.controller.enqueue(this.encoder.encode(message));
  }

  /**
   * Emit a progress update event
   */
  progress(data: ProgressData): void {
    this.emit("progress", data);
  }

  /**
   * Emit a log entry event
   */
  log(data: LogData): void {
    this.emit("log", data);
  }

  /**
   * Emit a completion event
   */
  complete(data: CompleteData): void {
    this.emit("complete", data);
  }

  /**
   * Emit an error event
   */
  error(message: string, metadata?: Record<string, unknown>): void {
    this.emit("error", { message, metadata });
  }

  /**
   * Close the SSE stream
   */
  close(): void {
    if (this.controller) {
      try {
        this.controller.close();
        console.info("[SSE] Controller closed");
      } catch (e) {
        console.error("[SSE] Error closing controller:", e);
      } finally {
        this.controller = null;
      }
    }
  }
}

/**
 * Global store of active SSE emitters by benchmark run ID
 * Allows broadcasting from anywhere in the application
 */
const activeEmitters = new Map<string, SSEEmitter>();

/**
 * Get or create an SSE emitter for a specific benchmark run
 * @param runId - The benchmark run ID
 * @returns The SSE emitter for this run
 */
export function getEmitter(runId: string): SSEEmitter {
  if (!activeEmitters.has(runId)) {
    console.info(`[SSE] Creating new emitter for run: ${runId}`);
    activeEmitters.set(runId, new SSEEmitter());
  }
  return activeEmitters.get(runId)!;
}

/**
 * Close and remove an SSE emitter for a specific benchmark run
 * @param runId - The benchmark run ID
 */
export function closeEmitter(runId: string): void {
  const emitter = activeEmitters.get(runId);
  if (emitter) {
    console.info(`[SSE] Closing emitter for run: ${runId}`);
    emitter.close();
    activeEmitters.delete(runId);
  }
}

/**
 * Close all active emitters (useful for cleanup)
 */
export function closeAllEmitters(): void {
  console.info(`[SSE] Closing all emitters (${activeEmitters.size} active)`);
  for (const [, emitter] of activeEmitters.entries()) {
    emitter.close();
  }
  activeEmitters.clear();
}

/**
 * Get count of active connections
 */
export function getActiveConnectionCount(): number {
  return activeEmitters.size;
}

/**
 * Clean up stale emitters
 */
export function cleanupStaleEmitters(): number {
  let cleaned = 0;

  for (const [runId, emitter] of activeEmitters.entries()) {
    // We can't directly check age since we don't store creation time
    // But we can check if the stream is still open by attempting to get the controller
    if (!emitter.getStream()) {
      activeEmitters.delete(runId);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.info(`[SSE] Cleaned up ${cleaned} stale emitters`);
  }

  return cleaned;
}
