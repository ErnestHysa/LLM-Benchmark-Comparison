/**
 * Zod validators for API requests
 */

import { z } from "zod";

/**
 * Benchmark category enum
 */
export const CategoryTypeEnum = z.enum([
  "CODING",
  "WRITING",
  "REASONING",
  "DEBUGGING",
  "API_DESIGN",
  "DATABASE_SCHEMA",
  "UI_UX_DESIGN",
  "DATA_ANALYSIS",
]);

export type CategoryType = z.infer<typeof CategoryTypeEnum>;

/**
 * Run status enum
 */
export const RunStatusEnum = z.enum([
  "PENDING",
  "RUNNING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "TIMEOUT",
]);

export type RunStatus = z.infer<typeof RunStatusEnum>;

/**
 * Model provider enum
 */
export const ModelProviderEnum = z.enum(["OPENAI", "ANTHROPIC", "OPENROUTER", "CUSTOM"]);

export type ModelProvider = z.infer<typeof ModelProviderEnum>;

/**
 * List benchmarks query schema
 */
export const ListBenchmarksQuerySchema = z.object({
  category: CategoryTypeEnum.optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  search: z.string().optional(),
});

/**
 * Benchmark detail params schema
 */
export const BenchmarkParamsSchema = z.object({
  id: z.string().min(1),
});

/**
 * Model details for benchmark run
 */
export const ModelDetailsSchema = z.object({
  id: z.string(),
  provider: ModelProviderEnum,
  providerId: z.string(), // The actual model ID to use for API calls (e.g., "z-ai/glm-4.5-air:free")
});

/**
 * Run benchmark request schema
 */
export const RunBenchmarkSchema = z.object({
  benchmarkId: z.string().min(1, "Benchmark ID is required"),
  modelIds: z
    .array(z.string().min(1))
    .min(1, "At least one model must be selected")
    .max(10, "Cannot run more than 10 models at once"),
  models: z.array(ModelDetailsSchema).optional(), // Optional model details for custom models
  categories: z.array(CategoryTypeEnum).min(1, "At least one category must be selected").optional(),
  evaluator: z.string().min(1).default("gpt-4o"),
  evaluatorProvider: ModelProviderEnum.default("OPENAI"),
  concurrency: z.number().min(1).max(10).default(3),
  timeoutSec: z.number().min(10).max(3600).optional().default(600),
  apiKeys: z.record(z.string()).optional(),
});

export type RunBenchmarkRequest = z.infer<typeof RunBenchmarkSchema>;

/**
 * Result detail params schema
 */
export const ResultParamsSchema = z.object({
  id: z.string().min(1),
});

/**
 * Human rating request schema
 */
export const HumanRatingSchema = z.object({
  modelRunId: z.string().min(1),
  categoryId: CategoryTypeEnum.optional(),
  rating: z.number().min(0).max(100),
  notes: z.string().max(5000).optional(),
});

export type HumanRatingRequest = z.infer<typeof HumanRatingSchema>;

/**
 * API key test schema
 */
export const TestApiKeySchema = z.object({
  provider: ModelProviderEnum,
  apiKey: z.string().min(1, "API key is required"),
});

export type TestApiKeyRequest = z.infer<typeof TestApiKeySchema>;

/**
 * Model registration schema
 */
export const RegisterModelSchema = z.object({
  name: z.string().min(1).max(100),
  provider: ModelProviderEnum,
  providerId: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

export type RegisterModelRequest = z.infer<typeof RegisterModelSchema>;

/**
 * Custom endpoint schema
 */
export const CustomEndpointSchema = z.object({
  name: z.string().min(1).max(50),
  baseURL: z.string().url("Must be a valid URL"),
  apiKey: z.string().optional(),
  defaultModel: z.string().optional(),
  headers: z.record(z.string()).optional(),
});

export type CustomEndpointRequest = z.infer<typeof CustomEndpointSchema>;
