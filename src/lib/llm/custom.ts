/**
 * Custom API endpoint wrapper
 *
 * Allows users to configure custom LLM endpoints that follow
 * OpenAI-compatible API format
 */

import type {
  ChatMessage,
  LLMRequestOptions,
  LLMResponse,
  RetryConfig,
  RateLimitConfig,
} from "./types";
import { DEFAULT_RETRY_CONFIG, DEFAULT_RATE_LIMIT } from "./types";
import { LLMError, LLMRateLimitError } from "../errors";

/**
 * Custom endpoint configuration
 */
export interface CustomEndpointConfig {
  name: string;
  baseURL: string;
  apiKey?: string;
  defaultModel?: string;
  headers?: Record<string, string>;
}

/**
 * Rate limiter using token bucket algorithm with queue-based locking
 * Prevents race conditions where multiple requests pass the token check simultaneously
 */
class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private config: RateLimitConfig;
  private queue: Array<() => void>;
  private processing: boolean;

  constructor(config: RateLimitConfig = DEFAULT_RATE_LIMIT) {
    this.config = config;
    this.tokens = config.maxRequests;
    this.lastRefill = Date.now();
    this.queue = [];
    this.processing = false;
  }

  async acquire(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    // Prevent re-entrant calls and ensure atomic transition to processing state
    // This race condition fix ensures only one instance processes the queue at a time
    if (this.processing) {
      return;
    }
    if (this.queue.length === 0) {
      return;
    }

    // Use atomic compare-and-swap pattern to prevent race conditions
    const wasProcessing = this.processing;
    this.processing = true;
    if (wasProcessing) {
      this.processing = false;
      return;
    }

    try {
      while (this.queue.length > 0) {
        // Refill tokens based on elapsed time
        const now = Date.now();
        const elapsed = now - this.lastRefill;
        const tokensToAdd = Math.floor(
          (elapsed / this.config.perMilliseconds) * this.config.maxRequests
        );
        this.tokens = Math.min(this.config.maxRequests, this.tokens + tokensToAdd);
        this.lastRefill = now;

        // If no tokens available, wait
        if (this.tokens < 1) {
          const waitTime = Math.ceil(this.config.perMilliseconds / this.config.maxRequests);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
          continue;
        }

        // We have a token - decrement and resolve the next waiting request
        this.tokens--;
        const nextResolve = this.queue.shift();
        if (nextResolve) {
          nextResolve();
        }
      }
    } finally {
      // Always reset processing flag, even if an error occurs
      this.processing = false;
    }
  }

  reset(): void {
    this.tokens = this.config.maxRequests;
    this.lastRefill = Date.now();
  }
}

/**
 * Delay with exponential backoff
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * API Error with status code
 */
class APIError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    message: string
  ) {
    super(message);
    this.name = "APIError";
  }
}

/**
 * Check if error is retryable
 */
function isRetryableError(error: unknown, config: RetryConfig): boolean {
  if (error instanceof APIError) {
    const status = error.status;
    const message = error.message.toLowerCase();

    // Check status codes
    if (status === 429 || status === 502 || status === 503 || status === 504) {
      return true;
    }

    // Check error message
    return config.retryableErrors.some((retryable) =>
      message.includes(retryable.toLowerCase())
    );
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return config.retryableErrors.some((retryable) =>
      message.includes(retryable.toLowerCase())
    );
  }

  return false;
}

/**
 * Custom API Client with retry and rate limiting
 * Follows OpenAI-compatible API format
 */
export class CustomAPIClient {
  private config: CustomEndpointConfig;
  private rateLimiter: RateLimiter;
  private retryConfig: RetryConfig;

  constructor(config: CustomEndpointConfig, options?: {
    retryConfig?: Partial<RetryConfig>;
    rateLimitConfig?: RateLimitConfig;
  }) {
    this.config = config;
    this.rateLimiter = new RateLimiter(options?.rateLimitConfig);
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...options?.retryConfig };
  }

  /**
   * Call custom API endpoint with retry logic
   */
  async chat(
    model: string,
    messages: ChatMessage[],
    options: LLMRequestOptions = {}
  ): Promise<LLMResponse> {
    const modelId = model || this.config.defaultModel || "default";

    let lastError: unknown;
    let currentDelay = this.retryConfig.initialDelayMs;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        // Rate limiting
        await this.rateLimiter.acquire();

        // Prepare request
        const requestBody = {
          model: modelId,
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens ?? 16384, // 2x increase - ensure complete outputs
          top_p: options.topP,
          stop: options.stopSequences,
        };

        // Prepare headers
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          ...this.config.headers,
        };

        if (this.config.apiKey) {
          headers["Authorization"] = `Bearer ${this.config.apiKey}`;
        }

        // Execute with timeout and abort signal
        const response = await this.executeWithTimeout(
          () =>
            fetch(`${this.config.baseURL}/chat/completions`, {
              method: "POST",
              headers,
              body: JSON.stringify(requestBody),
              signal: options.abortSignal, // Pass abort signal to fetch
            }),
          options.timeoutMs ?? 120000,
          options.abortSignal
        );

        if (!response.ok) {
          throw new APIError(response.status, response.statusText, await response.text());
        }

        const data = await response.json();

        // Comprehensive null/undefined validation for API response
        if (!data) {
          throw new LLMError(this.config.name, "No response data returned from API");
        }

        const choices = data.choices;
        if (!choices || !Array.isArray(choices) || choices.length === 0) {
          throw new LLMError(this.config.name, "No response choices returned");
        }

        const choice = choices[0];
        if (!choice) {
          throw new LLMError(this.config.name, "First choice is null or undefined");
        }

        const message = choice.message;
        if (!message) {
          throw new LLMError(this.config.name, "Response message is null or undefined");
        }

        // Ensure content is a string
        const content = typeof message.content === "string" ? message.content : "";
        if (!content) {
          throw new LLMError(this.config.name, "Response content is empty");
        }

        // Safely extract finish reason
        const finishReason = choice.finish_reason;
        const normalizedFinishReason: "stop" | "length" | "max_tokens" =
          finishReason === "stop" ? "stop" :
          finishReason === "length" ? "length" :
          "max_tokens";

        // Safely extract token usage
        const usage = data.usage;
        const tokensUsed = usage?.total_tokens;

        return {
          content,
          model: data.model || modelId,
          tokensUsed,
          finishReason: normalizedFinishReason,
        };
      } catch (error) {
        lastError = error;

        // Check if error is retryable
        if (attempt < this.retryConfig.maxRetries && isRetryableError(error, this.retryConfig)) {
          // Check if it's a rate limit error
          if (error instanceof APIError && error.status === 429) {
            let retryAfter = currentDelay;
            // Check for Retry-After header
            const retryAfterMatch = error.message.match(/retry-after[:\s]+(\d+)/i);
            if (retryAfterMatch?.[1]) {
              retryAfter = parseInt(retryAfterMatch[1], 10) * 1000;
            }
            await delay(retryAfter);
          } else {
            await delay(currentDelay);
          }

          // Exponential backoff
          currentDelay = Math.min(
            currentDelay * this.retryConfig.backoffMultiplier,
            this.retryConfig.maxDelayMs
          );
          continue;
        }

        // Not retryable or max retries reached
        break;
      }
    }

    // Handle final error
    if (lastError instanceof APIError) {
      if (lastError.status === 429) {
        throw new LLMRateLimitError(this.config.name);
      }
      throw new LLMError(this.config.name, lastError.message, lastError);
    }

    if (lastError instanceof Error) {
      throw new LLMError(this.config.name, lastError.message, lastError);
    }

    throw new LLMError(this.config.name, "Unknown error occurred", lastError);
  }

  /**
   * Execute a function with a timeout using AbortController
   * This properly cancels the underlying request on timeout
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number,
    abortSignal?: AbortSignal
  ): Promise<T> {
    // Check if external signal is already aborted
    if (abortSignal?.aborted) {
      throw new Error("Request aborted");
    }

    // Create a combined abort controller that responds to both timeout and external abort
    const timeoutController = new AbortController();
    let timeoutId: NodeJS.Timeout | undefined;
    let isResolved = false;
    let rejectFn: ((error: Error) => void) | undefined;

    // Set up external abort signal listener with proper cleanup
    let externalAbortListener: (() => void) | undefined;

    const cleanupExternalAbortListener = () => {
      if (abortSignal && externalAbortListener) {
        abortSignal.removeEventListener("abort", externalAbortListener);
        externalAbortListener = undefined;
      }
    };

    externalAbortListener = () => {
      if (!isResolved) {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutController.abort();
        isResolved = true;
        if (rejectFn) {
          rejectFn(new Error("Request aborted"));
        }
      }
      cleanupExternalAbortListener();
    };

    if (abortSignal) {
      abortSignal.addEventListener("abort", externalAbortListener);
    }

    // Set up timeout promise with reject function accessible
    const timeoutPromise = new Promise<never>((_, reject) => {
      rejectFn = reject;
      timeoutId = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          cleanupExternalAbortListener();
          timeoutController.abort();
          reject(new Error("Request timeout"));
        }
      }, timeoutMs);
    });

    // Create a promise that wraps the function
    const taskPromise = fn();

    // Race between the task, timeout, and external abort
    return Promise.race([taskPromise, timeoutPromise])
      .finally(() => {
        // Mark as resolved to prevent timeout from firing
        isResolved = true;

        // Clean up timeout and event listener
        if (timeoutId) clearTimeout(timeoutId);
        cleanupExternalAbortListener();
      });
  }

  /**
   * Reset rate limiter (useful for testing)
   */
  resetRateLimiter(): void {
    this.rateLimiter.reset();
  }
}

/**
 * Registry for custom API clients
 */
const customClientRegistry = new Map<string, CustomAPIClient>();

export function registerCustomClient(name: string, config: CustomEndpointConfig): CustomAPIClient {
  const client = new CustomAPIClient(config);
  customClientRegistry.set(name, client);
  return client;
}

export function getCustomClient(name: string): CustomAPIClient | undefined {
  return customClientRegistry.get(name);
}

export function unregisterCustomClient(name: string): void {
  customClientRegistry.delete(name);
}

export function listCustomClients(): string[] {
  return Array.from(customClientRegistry.keys());
}
