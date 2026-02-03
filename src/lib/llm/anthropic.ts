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
          max_tokens: options.maxTokens ?? 4096,
          temperature: options.temperature,
          top_p: options.topP,
          stop_sequences: options.stopSequences,
        };

        // Execute with timeout
        const response = await this.executeWithTimeout(
          () => this.client.messages.create(request),
          options.timeoutMs ?? 120000
        );

        const contentBlock = response.content.find((block) => block.type === "text");
        const content = contentBlock?.type === "text" ? contentBlock.text : "";

        return {
          content,
          model: response.model,
          tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
          finishReason: response.stop_reason === "end_turn" ? "stop" :
                       response.stop_reason === "max_tokens" ? "length" :
                       "max_tokens",
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
