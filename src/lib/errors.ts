/**
 * Custom error classes for the LLM Benchmark platform
 * All errors follow the API error response format from the roadmap
 */

export enum ErrorCode {
  VALIDATION_ERROR = "VALIDATION_ERROR",
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  NOT_FOUND = "NOT_FOUND",
  RATE_LIMITED = "RATE_LIMITED",
  INTERNAL_ERROR = "INTERNAL_ERROR",
  BENCHMARK_TIMEOUT = "BENCHMARK_TIMEOUT",
}

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace?.(this, this.constructor);
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details && { details: this.details }),
      },
    };
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(ErrorCode.VALIDATION_ERROR, message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = "Authentication required", details?: Record<string, unknown>) {
    super(ErrorCode.UNAUTHORIZED, message, details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = "Access denied", details?: Record<string, unknown>) {
    super(ErrorCode.FORBIDDEN, message, details);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    const message = id ? `${resource} with ID '${id}' not found` : `${resource} not found`;
    super(ErrorCode.NOT_FOUND, message, { resource, id });
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = "Too many requests", details?: Record<string, unknown>) {
    super(ErrorCode.RATE_LIMITED, message, details);
  }
}

export class InternalError extends AppError {
  constructor(message: string = "Internal server error", details?: Record<string, unknown>) {
    super(ErrorCode.INTERNAL_ERROR, message, details);
  }
}

export class BenchmarkTimeoutError extends AppError {
  constructor(timeoutSec: number) {
    super(
      ErrorCode.BENCHMARK_TIMEOUT,
      `Benchmark exceeded timeout of ${timeoutSec} seconds`,
      { timeoutSec }
    );
  }
}

/**
 * LLM Provider-specific errors
 */
export class LLMError extends AppError {
  constructor(
    provider: string,
    message: string,
    public originalError?: unknown
  ) {
    super(ErrorCode.INTERNAL_ERROR, `[${provider}] ${message}`, { provider });
  }
}

export class LLMRateLimitError extends AppError {
  constructor(provider: string, retryAfter?: number) {
    super(
      ErrorCode.RATE_LIMITED,
      `${provider} API rate limit exceeded`,
      { provider, retryAfter }
    );
  }
}

/**
 * Error response formatter for API routes
 */
export function errorResponse(error: unknown): {
  error: { code: string; message: string; details?: Record<string, unknown> };
} {
  if (error instanceof AppError) {
    return error.toJSON();
  }

  if (error instanceof Error) {
    return {
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: error.message,
      },
    };
  }

  return {
    error: {
      code: ErrorCode.INTERNAL_ERROR,
      message: "An unknown error occurred",
    },
  };
}

/**
 * Get HTTP status code for error type
 */
export function getStatusCode(error: AppError): number {
  switch (error.code) {
    case ErrorCode.VALIDATION_ERROR:
      return 400;
    case ErrorCode.UNAUTHORIZED:
      return 401;
    case ErrorCode.FORBIDDEN:
      return 403;
    case ErrorCode.NOT_FOUND:
      return 404;
    case ErrorCode.RATE_LIMITED:
      return 429;
    case ErrorCode.BENCHMARK_TIMEOUT:
      return 504;
    case ErrorCode.INTERNAL_ERROR:
    default:
      return 500;
  }
}

/**
 * Error logging utility
 */
export function logError(error: unknown, context?: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  const errorInfo = error instanceof Error ? {
    name: error.name,
    message: error.message,
    stack: error.stack,
  } : error;

  console.error("[ERROR]", {
    timestamp,
    error: errorInfo,
    ...(context && { context }),
  });
}
