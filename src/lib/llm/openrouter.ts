/**
 * OpenRouter client wrapper with retry logic and rate limiting
 *
 * OpenRouter provides access to 100+ models through a unified API
 * API Documentation: https://openrouter.ai/docs
 */

import OpenAI from "openai";
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
 * OpenRouter-specific configuration
 */
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

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
 * Check if error is retryable
 */
function isRetryableError(error: unknown, config: RetryConfig): boolean {
  if (error instanceof OpenAI.APIError) {
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
 * OpenRouter Client with retry and rate limiting
 * Uses OpenAI SDK with custom base URL
 */
export class OpenRouterClient {
  private client: OpenAI;
  private rateLimiter: RateLimiter;
  private retryConfig: RetryConfig;

  constructor(apiKey: string, options?: {
    baseURL?: string;
    retryConfig?: Partial<RetryConfig>;
    rateLimitConfig?: RateLimitConfig;
  }) {
    this.client = new OpenAI({
      apiKey,
      baseURL: options?.baseURL ?? OPENROUTER_BASE_URL,
      defaultHeaders: {
        "HTTP-Referer": typeof window !== "undefined" ? window.location.href : "",
        "X-Title": "LLM Benchmark Comparison Platform",
      },
    });

    this.rateLimiter = new RateLimiter(options?.rateLimitConfig);
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...options?.retryConfig };
  }

  /**
   * Call OpenRouter Chat Completions API with retry logic
   */
  async chat(
    model: string,
    messages: ChatMessage[],
    options: LLMRequestOptions = {}
  ): Promise<LLMResponse> {
    let lastError: unknown;
    let currentDelay = this.retryConfig.initialDelayMs;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        // Rate limiting
        await this.rateLimiter.acquire();

        // Prepare request
        const request: OpenAI.ChatCompletionCreateParamsNonStreaming = {
          model,
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens,
          top_p: options.topP,
          stop: options.stopSequences,
        };

        // Execute with timeout
        const response = await this.executeWithTimeout(
          () => this.client.chat.completions.create(request),
          options.timeoutMs ?? 120000
        );

        const choice = response.choices[0];
        if (!choice) {
          throw new LLMError("OpenRouter", "No response choices returned");
        }

        return {
          content: choice.message.content ?? "",
          model: response.model,
          tokensUsed: response.usage?.total_tokens,
          finishReason: choice.finish_reason === "stop" ? "stop" :
                       choice.finish_reason === "length" ? "length" :
                       choice.finish_reason === "content_filter" ? "content_filter" :
                       "max_tokens",
        };
      } catch (error) {
        lastError = error;

        // Check if error is retryable
        if (attempt < this.retryConfig.maxRetries && isRetryableError(error, this.retryConfig)) {
          // Check if it's a rate limit error
          if (error instanceof OpenAI.RateLimitError || error instanceof OpenAI.APIError && error.status === 429) {
            // Use Retry-After header if available
            let retryAfter = currentDelay;
            if (error instanceof OpenAI.APIError) {
              const retryAfterHeader = error.headers?.["retry-after"];
              if (retryAfterHeader) {
                retryAfter = parseInt(retryAfterHeader, 10) * 1000;
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
    if (lastError instanceof OpenAI.RateLimitError || lastError instanceof OpenAI.APIError && lastError.status === 429) {
      throw new LLMRateLimitError("OpenRouter");
    }

    if (lastError instanceof OpenAI.APIError) {
      throw new LLMError("OpenRouter", lastError.message, lastError);
    }

    if (lastError instanceof Error) {
      throw new LLMError("OpenRouter", lastError.message, lastError);
    }

    throw new LLMError("OpenRouter", "Unknown error occurred", lastError);
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

  /**
   * Get available models from OpenRouter
   */
  async getAvailableModels(): Promise<Array<{ id: string; name: string; context_length: number }>> {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/models");
      const data = await response.json();
      return data.data || [];
    } catch (error) {
      throw new LLMError("OpenRouter", "Failed to fetch available models", error);
    }
  }
}

/**
 * Create a singleton OpenRouter client instance
 */
let openrouterClient: OpenRouterClient | null = null;

export function getOpenRouterClient(apiKey?: string): OpenRouterClient {
  if (!openrouterClient && apiKey) {
    openrouterClient = new OpenRouterClient(apiKey);
  }

  if (!openrouterClient) {
    throw new LLMError("OpenRouter", "OpenRouter client not initialized. Provide API key.");
  }

  return openrouterClient;
}

export function resetOpenRouterClient(): void {
  openrouterClient = null;
}
