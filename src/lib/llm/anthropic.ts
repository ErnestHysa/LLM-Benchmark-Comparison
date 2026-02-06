/**
 * Anthropic client wrapper with retry logic and rate limiting
 */

import Anthropic from "@anthropic-ai/sdk";
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
 * Convert messages to Anthropic format
 * Anthropic requires system message to be separate
 */
function convertMessagesToAnthropic(messages: ChatMessage[]): {
  system: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
} {
  let system = "";
  const convertedMessages: Array<{ role: "user" | "assistant"; content: string }> = [];

  for (const message of messages) {
    if (message.role === "system") {
      system = message.content;
    } else {
      convertedMessages.push({
        role: message.role as "user" | "assistant",
        content: message.content,
      });
    }
  }

  return { system, messages: convertedMessages };
}

/**
 * Check if error is retryable
 */
function isRetryableError(error: unknown, config: RetryConfig): boolean {
  if (error instanceof Anthropic.APIError) {
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
 * Anthropic Client with retry and rate limiting
 */
export class AnthropicClient {
  private client: Anthropic;
  private rateLimiter: RateLimiter;
  private retryConfig: RetryConfig;

  constructor(apiKey: string, options?: {
    baseURL?: string;
    retryConfig?: Partial<RetryConfig>;
    rateLimitConfig?: RateLimitConfig;
  }) {
    this.client = new Anthropic({
      apiKey,
      baseURL: options?.baseURL,
    });

    this.rateLimiter = new RateLimiter(options?.rateLimitConfig);
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...options?.retryConfig };
  }

  /**
   * Call Anthropic Messages API with retry logic
   */
  async chat(
    model: string,
    messages: ChatMessage[],
    options: LLMRequestOptions = {}
  ): Promise<LLMResponse> {
    let lastError: unknown;
    let currentDelay = this.retryConfig.initialDelayMs;

    const { system, messages: anthropicMessages } = convertMessagesToAnthropic(messages);

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        // Rate limiting
        await this.rateLimiter.acquire();

        // Prepare request
        const request: Anthropic.MessageCreateParams = {
          model: model as Anthropic.Model,
          messages: anthropicMessages,
          system: system || undefined,
          max_tokens: options.maxTokens ?? 16384, // 2x increase - ensure complete outputs
          temperature: options.temperature,
          top_p: options.topP,
          stop_sequences: options.stopSequences,
        };

        // Execute with timeout and abort signal
        const response = await this.executeWithTimeout(
          () => this.client.messages.create(request),
          options.timeoutMs ?? 120000,
          options.abortSignal
        );

        // Comprehensive null/undefined validation for API response
        if (!response) {
          throw new LLMError("Anthropic", "No response returned from API");
        }

        const content = response.content;
        if (!content || content.length === 0) {
          throw new LLMError("Anthropic", "Response content is empty");
        }

        const contentBlock = content.find((block) => block.type === "text");
        if (!contentBlock) {
          throw new LLMError("Anthropic", "No text content block in response");
        }

        const text = contentBlock.type === "text" ? contentBlock.text : "";
        if (!text) {
          throw new LLMError("Anthropic", "Text content is empty");
        }

        // Safely extract usage information
        const usage = response.usage;
        if (!usage) {
          throw new LLMError("Anthropic", "Usage information is missing from response");
        }

        const tokensUsed = (usage.input_tokens || 0) + (usage.output_tokens || 0);

        // Safely extract stop reason
        const stopReason = response.stop_reason;
        const normalizedFinishReason: "stop" | "length" | "max_tokens" =
          stopReason === "end_turn" ? "stop" :
          stopReason === "max_tokens" ? "length" :
          "max_tokens";

        return {
          content: text,
          model: response.model || model,
          tokensUsed,
          finishReason: normalizedFinishReason,
        };
      } catch (error) {
        lastError = error;

        // Check if error is retryable
        if (attempt < this.retryConfig.maxRetries && isRetryableError(error, this.retryConfig)) {
          // Check if it's a rate limit error
          if (error instanceof Anthropic.RateLimitError || error instanceof Anthropic.APIError && error.status === 429) {
            // Use Retry-After header if available
            let retryAfter = currentDelay;
            if (error instanceof Anthropic.APIError) {
              const retryAfterHeader = error.headers?.["retry-after"];
              if (retryAfterHeader) {
                retryAfter = parseInt(String(retryAfterHeader), 10) * 1000;
              }
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
    if (lastError instanceof Anthropic.RateLimitError || lastError instanceof Anthropic.APIError && lastError.status === 429) {
      throw new LLMRateLimitError("Anthropic");
    }

    if (lastError instanceof Anthropic.APIError) {
      throw new LLMError("Anthropic", lastError.message, lastError);
    }

    if (lastError instanceof Error) {
      throw new LLMError("Anthropic", lastError.message, lastError);
    }

    throw new LLMError("Anthropic", "Unknown error occurred", lastError);
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

    // Create a promise that wraps the function with abort signal
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
 * Create a singleton Anthropic client instance
 */
let anthropicClient: AnthropicClient | null = null;

export function getAnthropicClient(apiKey?: string): AnthropicClient {
  if (!anthropicClient && apiKey) {
    anthropicClient = new AnthropicClient(apiKey);
  }

  if (!anthropicClient) {
    throw new LLMError("Anthropic", "Anthropic client not initialized. Provide API key.");
  }

  return anthropicClient;
}

export function resetAnthropicClient(): void {
  anthropicClient = null;
}
