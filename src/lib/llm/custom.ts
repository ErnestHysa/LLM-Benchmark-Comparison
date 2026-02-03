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
 * Rate limiter using token bucket algorithm
 */
class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig = DEFAULT_RATE_LIMIT) {
    this.config = config;
    this.tokens = config.maxRequests;
    this.lastRefill = Date.now();
  }

  async acquire(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRefill;

    // Refill tokens based on elapsed time
    const tokensToAdd = (elapsed / this.config.perMilliseconds) * this.config.maxRequests;
    this.tokens = Math.min(this.config.maxRequests, this.tokens + tokensToAdd);
    this.lastRefill = now;

    if (this.tokens < 1) {
      const waitTime = this.config.perMilliseconds / this.config.maxRequests;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      await this.acquire();
      return;
    }

    this.tokens--;
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
          max_tokens: options.maxTokens,
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

        // Execute with timeout
        const response = await this.executeWithTimeout(
          () =>
            fetch(`${this.config.baseURL}/chat/completions`, {
              method: "POST",
              headers,
              body: JSON.stringify(requestBody),
            }),
          options.timeoutMs ?? 120000
        );

        if (!response.ok) {
          throw new APIError(response.status, response.statusText, await response.text());
        }

        const data = await response.json();

        const choice = data.choices?.[0];
        if (!choice) {
          throw new LLMError(this.config.name, "No response choices returned");
        }

        return {
          content: choice.message?.content ?? "",
          model: data.model || modelId,
          tokensUsed: data.usage?.total_tokens,
          finishReason: choice.finish_reason === "stop" ? "stop" :
                       choice.finish_reason === "length" ? "length" :
                       "max_tokens",
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
   * Execute a function with a timeout
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Request timeout")), timeoutMs);
    });

    return Promise.race([fn(), timeoutPromise]);
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
