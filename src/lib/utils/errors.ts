/**
 * Benchmark Error Classification & User-Friendly Messages
 *
 * Classifies errors from LLM API calls into specific types
 * and provides clear, actionable error messages for users.
 */

export enum BenchmarkErrorType {
  RATE_LIMIT = "rate_limit",
  TIMEOUT = "timeout",
  INVALID_MODEL = "invalid_model",
  API_KEY_INVALID = "api_key_invalid",
  NETWORK_ERROR = "network_error",
  CONTENT_FILTER = "content_filter",
  QUOTA_EXCEEDED = "quota_exceeded",
  UNKNOWN = "unknown",
}

/**
 * Get a user-friendly error message based on error type and model name
 */
export function getBenchmarkErrorMessage(
  errorType: BenchmarkErrorType,
  modelName: string
): string {
  switch (errorType) {
    case BenchmarkErrorType.RATE_LIMIT:
      return `Rate limit exceeded for ${modelName}. Please wait before retrying.`;
    case BenchmarkErrorType.TIMEOUT:
      return `${modelName} did not respond in time. The model may be overloaded.`;
    case BenchmarkErrorType.INVALID_MODEL:
      return `Model ${modelName} is not available or does not exist.`;
    case BenchmarkErrorType.API_KEY_INVALID:
      return `API key is invalid or expired. Please check your settings.`;
    case BenchmarkErrorType.NETWORK_ERROR:
      return `Network error while calling ${modelName}. Please check your internet connection.`;
    case BenchmarkErrorType.CONTENT_FILTER:
      return `${modelName} response was blocked by content filter.`;
    case BenchmarkErrorType.QUOTA_EXCEEDED:
      return `API quota exceeded for ${modelName}. Check your account billing.`;
    default:
      return `An error occurred with ${modelName}. Please try again.`;
  }
}

/**
 * Classify an error into a BenchmarkErrorType
 *
 * Inspects error status codes, messages, and error names
 * to determine the most specific error type.
 */
export function classifyBenchmarkError(error: unknown): BenchmarkErrorType {
  if (!error) return BenchmarkErrorType.UNKNOWN;

  // Check for status code-based classification
  const status = getErrorStatus(error);
  if (status === 429) return BenchmarkErrorType.RATE_LIMIT;
  if (status === 401 || status === 403) return BenchmarkErrorType.API_KEY_INVALID;
  if (status === 404) return BenchmarkErrorType.INVALID_MODEL;
  if (status === 402) return BenchmarkErrorType.QUOTA_EXCEEDED;

  // Check for error message-based classification
  const message = getErrorMessage(error).toLowerCase();

  if (
    message.includes("rate limit") ||
    message.includes("rate_limit") ||
    message.includes("too many requests")
  ) {
    return BenchmarkErrorType.RATE_LIMIT;
  }

  if (
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("request timeout") ||
    message.includes("deadline exceeded")
  ) {
    return BenchmarkErrorType.TIMEOUT;
  }

  if (
    message.includes("invalid api key") ||
    message.includes("unauthorized") ||
    message.includes("authentication") ||
    message.includes("api key")
  ) {
    return BenchmarkErrorType.API_KEY_INVALID;
  }

  if (
    message.includes("model not found") ||
    message.includes("not available") ||
    message.includes("does not exist") ||
    message.includes("unknown model")
  ) {
    return BenchmarkErrorType.INVALID_MODEL;
  }

  if (
    message.includes("network") ||
    message.includes("econnrefused") ||
    message.includes("enotfound") ||
    message.includes("fetch failed") ||
    message.includes("connection")
  ) {
    return BenchmarkErrorType.NETWORK_ERROR;
  }

  if (
    message.includes("content filter") ||
    message.includes("content_filter") ||
    message.includes("blocked")
  ) {
    return BenchmarkErrorType.CONTENT_FILTER;
  }

  if (
    message.includes("quota") ||
    message.includes("billing") ||
    message.includes("insufficient")
  ) {
    return BenchmarkErrorType.QUOTA_EXCEEDED;
  }

  // Check error name
  const errorName = getErrorName(error).toLowerCase();
  if (errorName.includes("timeout")) return BenchmarkErrorType.TIMEOUT;
  if (errorName.includes("ratelimit")) return BenchmarkErrorType.RATE_LIMIT;

  return BenchmarkErrorType.UNKNOWN;
}

function getErrorStatus(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null) {
    const e = error as Record<string, unknown>;
    if (typeof e.status === "number") return e.status;
    if (typeof e.statusCode === "number") return e.statusCode;
  }
  return undefined;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (typeof error === "object" && error !== null) {
    const e = error as Record<string, unknown>;
    if (typeof e.message === "string") return e.message;
  }
  return "";
}

function getErrorName(error: unknown): string {
  if (error instanceof Error) return error.name;
  if (typeof error === "object" && error !== null) {
    const e = error as Record<string, unknown>;
    if (typeof e.name === "string") return e.name;
  }
  return "";
}
