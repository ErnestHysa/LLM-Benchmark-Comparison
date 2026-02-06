/**
 * AI Evaluator Service
 *
 * Uses an LLM to evaluate outputs and assign scores
 * based on defined metrics and categories
 */

import type {
  ChatMessage,
} from "./types";
import { getOpenAIClient, type OpenAIClient } from "./openai";
import { getAnthropicClient, type AnthropicClient } from "./anthropic";
import { getOpenRouterClient, type OpenRouterClient } from "./openrouter";
import { getCustomClient, type CustomAPIClient } from "./custom";
import { LLMError } from "../errors";

/**
 * Evaluation result for a single metric
 */
export interface MetricEvaluation {
  name: string;
  score: number; // 0-100
  reasoning: string;
  confidence: number; // 0-1
}

/**
 * Evaluation result for a category
 */
export interface CategoryEvaluation {
  category: string;
  totalScore: number; // Weighted average of metrics
  metrics: MetricEvaluation[];
}

/**
 * Full evaluation result
 */
export interface EvaluationResult {
  modelId: string;
  categoryEvaluations: CategoryEvaluation[];
  totalScore: number; // Overall score
  aiConfidence: number;
  evaluator: string;
}

/**
 * Evaluation request
 */
export interface EvaluationRequest {
  modelId: string;
  output: string;
  benchmarkId: string;
  prompt: string;
  categories: string[];
  evaluatorModelId: string;
  evaluatorProvider?: "openai" | "anthropic" | "openrouter" | "custom";
  evaluatorApiKey?: string;
}

/**
 * Get evaluator client based on provider
 */
function getEvaluatorClient(
  provider: "openai" | "anthropic" | "openrouter" | "custom",
  modelId: string,
  apiKey?: string
): OpenAIClient | AnthropicClient | OpenRouterClient | CustomAPIClient {
  switch (provider) {
    case "openai":
      return getOpenAIClient(apiKey);
    case "anthropic":
      return getAnthropicClient(apiKey);
    case "openrouter":
      return getOpenRouterClient(apiKey);
    case "custom":
      const client = getCustomClient(modelId);
      if (!client) {
        throw new LLMError("Custom", `No custom client found for model: ${modelId}`);
      }
      return client;
    default:
      throw new LLMError("Evaluator", `Unknown provider: ${provider}`);
  }
}

/**
 * Build evaluation prompt
 */
function buildEvaluationPrompt(
  prompt: string,
  output: string,
  categories: string[]
): string {
  return `You are an expert evaluator for AI model outputs. Your task is to evaluate the given output based on specific criteria.

**Original Prompt:**
${prompt}

**Model Output:**
${output}

**Categories to Evaluate:**
${categories.map((c) => `- ${c}`).join("\n")}

For each category, provide:
1. A score from 0-100 for each metric in that category
2. A brief reasoning for each score
3. Your confidence level (0-1) for each score

Respond ONLY in the following JSON format:
{
  "evaluations": [
    {
      "category": "CATEGORY_NAME",
      "metrics": [
        {
          "name": "METRIC_NAME",
          "score": 85,
          "reasoning": "Brief explanation",
          "confidence": 0.9
        }
      ]
    }
  ],
  "overallConfidence": 0.85
}

Ensure scores are integers between 0 and 100.`;
}

/**
 * Parse evaluation response from LLM
 */
function parseEvaluationResponse(response: string): {
  evaluations: Array<{
    category: string;
    metrics: Array<{
      name: string;
      score: number;
      reasoning: string;
      confidence: number;
    }>;
  }>;
  overallConfidence: number;
} {
  // Try to extract JSON from response
  const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) || response.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    console.error("[Evaluator] No JSON found in response", {
      responseLength: response.length,
      responsePreview: response.slice(0, 200),
    });
    throw new LLMError("Evaluator", "Failed to extract JSON from evaluation response");
  }

  try {
    const jsonStr = jsonMatch[1] || jsonMatch[0];
    const parsed = JSON.parse(jsonStr);

    // Validate the parsed structure has required fields
    if (!parsed.evaluations || !Array.isArray(parsed.evaluations)) {
      throw new LLMError("Evaluator", "Invalid evaluation structure: 'evaluations' array is missing");
    }

    // Ensure overallConfidence exists
    if (typeof parsed.overallConfidence !== "number") {
      parsed.overallConfidence = 0.8; // Default confidence
    }

    // Validate each evaluation has required fields
    for (const evaluationItem of parsed.evaluations) {
      if (!evaluationItem.category || !Array.isArray(evaluationItem.metrics)) {
        throw new LLMError("Evaluator", "Invalid evaluation structure: missing category or metrics");
      }
    }

    return parsed;
  } catch (error) {
    // Provide more detailed error information
    if (error instanceof LLMError) {
      throw error;
    }
    console.error("[Evaluator] JSON parse error", {
      error: error instanceof Error ? error.message : String(error),
      jsonPreview: jsonMatch[1]?.slice(0, 200) || jsonMatch[0]?.slice(0, 200),
    });
    throw new LLMError("Evaluator", "Failed to parse evaluation JSON", error);
  }
}

/**
 * Category metrics definition (from roadmap)
 */
const CATEGORY_METRICS: Record<string, Array<{ name: string; weight: number }>> = {
  CODING: [
    { name: "Functionality", weight: 0.30 },
    { name: "Code Quality", weight: 0.20 },
    { name: "Performance", weight: 0.15 },
    { name: "Design", weight: 0.15 },
    { name: "Readability", weight: 0.10 },
    { name: "UI/UX", weight: 0.05 },
    { name: "Security", weight: 0.05 },
  ],
  WRITING: [
    { name: "Creativity & Originality", weight: 0.25 },
    { name: "Coherence & Flow", weight: 0.20 },
    { name: "Engagement Factor", weight: 0.20 },
    { name: "Grammar & Style", weight: 0.15 },
    { name: "Structure", weight: 0.10 },
    { name: "Emotional Impact", weight: 0.10 },
  ],
  REASONING: [
    { name: "Accuracy", weight: 0.35 },
    { name: "Logical Flow", weight: 0.25 },
    { name: "Completeness", weight: 0.20 },
    { name: "Clarity", weight: 0.10 },
    { name: "Problem-Solving Approach", weight: 0.10 },
  ],
  DEBUGGING: [
    { name: "Fix Correctness", weight: 0.35 },
    { name: "Bug Detection Accuracy", weight: 0.25 },
    { name: "Explanation Quality", weight: 0.15 },
    { name: "Solution Efficiency", weight: 0.15 },
    { name: "Edge Cases", weight: 0.10 },
  ],
  API_DESIGN: [
    { name: "RESTfulness", weight: 0.25 },
    { name: "Documentation", weight: 0.20 },
    { name: "Scalability", weight: 0.20 },
    { name: "Security", weight: 0.20 },
    { name: "Error Handling", weight: 0.15 },
  ],
  DATABASE_SCHEMA: [
    { name: "Normalization", weight: 0.25 },
    { name: "Performance", weight: 0.25 },
    { name: "Data Integrity", weight: 0.20 },
    { name: "Scalability", weight: 0.15 },
    { name: "Clarity", weight: 0.15 },
  ],
  UI_UX_DESIGN: [
    { name: "Usability", weight: 0.30 },
    { name: "Visual Appeal", weight: 0.20 },
    { name: "Accessibility", weight: 0.15 },
    { name: "Responsiveness", weight: 0.15 },
    { name: "Consistency", weight: 0.20 },
  ],
  DATA_ANALYSIS: [
    { name: "Accuracy", weight: 0.30 },
    { name: "Insights Quality", weight: 0.25 },
    { name: "Methodology", weight: 0.20 },
    { name: "Visualization", weight: 0.15 },
    { name: "Explanation", weight: 0.10 },
  ],
};

/**
 * Get metrics for a category
 */
export function getCategoryMetrics(category: string): Array<{ name: string; weight: number }> {
  return CATEGORY_METRICS[category] || [];
}

/**
 * Evaluate output using AI evaluator
 */
export async function evaluateOutput(request: EvaluationRequest): Promise<EvaluationResult> {
  const {
    modelId,
    output,
    prompt,
    categories,
    evaluatorModelId,
    evaluatorProvider = "openai",
    evaluatorApiKey,
  } = request;

  // Get evaluator client
  const client = getEvaluatorClient(evaluatorProvider, evaluatorModelId, evaluatorApiKey);

  // Build evaluation prompt with metric details
  const metricDetails = categories
    .map((cat) => {
      const metrics = getCategoryMetrics(cat);
      if (metrics.length === 0) return null;
      return `**${cat} Metrics:**
${metrics.map((m) => `- ${m.name} (${(m.weight * 100).toFixed(0)}%)`).join("\n")}`;
    })
    .filter(Boolean)
    .join("\n\n");

  const fullPrompt = `${buildEvaluationPrompt(prompt, output, categories)}

${metricDetails}`;

  // Call evaluator model
  const messages: ChatMessage[] = [
    { role: "system", content: "You are an expert AI evaluator. Provide objective, fair assessments." },
    { role: "user", content: fullPrompt },
  ];

  const response = await client.chat(evaluatorModelId, messages, {
    temperature: 0.3, // Lower temperature for more consistent evaluations
    maxTokens: 16384, // 2x increase - ensure evaluator has enough tokens for detailed analysis
  });

  // Parse evaluation
  const evaluation = parseEvaluationResponse(response.content);

  // Build category evaluations
  const categoryEvaluations: CategoryEvaluation[] = [];

  for (const catEval of evaluation.evaluations) {
    const metrics = getCategoryMetrics(catEval.category);

    // Calculate weighted average score for this category
    let totalScore = 0;
    let totalWeight = 0;

    const metricEvaluations: MetricEvaluation[] = catEval.metrics.map((m) => {
      const metricDef = metrics.find((def) => def.name === m.name);
      // Use 0 as default weight for unknown metrics instead of 1
      // This prevents unknown/extra metrics from skewing the score
      const weight = metricDef?.weight ?? 0;

      // Log warning about unknown metric (helps identify AI hallucinations)
      if (!metricDef) {
        console.warn("[Evaluator] Unknown metric returned by AI", {
          category: catEval.category,
          unknownMetric: m.name,
          validMetrics: metrics.map((def) => def.name),
        });
      }

      totalScore += m.score * weight;
      totalWeight += weight;

      return {
        name: m.name,
        score: Math.max(0, Math.min(100, m.score)),
        reasoning: m.reasoning,
        confidence: Math.max(0, Math.min(1, m.confidence)),
      };
    });

    const categoryScore = totalWeight > 0 ? totalScore / totalWeight : 0;

    categoryEvaluations.push({
      category: catEval.category,
      totalScore: categoryScore,
      metrics: metricEvaluations,
    });
  }

  // Calculate overall score (equal weight for each category)
  // Guard against empty categoryEvaluations to prevent division by zero
  const totalScore = categoryEvaluations.length > 0
    ? categoryEvaluations.reduce((sum, cat) => sum + cat.totalScore, 0) / categoryEvaluations.length
    : 0;

  // Log warning if no categories were evaluated (indicates AI evaluator issue)
  if (categoryEvaluations.length === 0) {
    console.warn("[Evaluator] No category evaluations returned from AI", {
      modelId,
      evaluator: evaluatorModelId,
      rawResponse: evaluation,
    });
  }

  return {
    modelId,
    categoryEvaluations,
    totalScore,
    aiConfidence: evaluation.overallConfidence || 0.8,
    evaluator: evaluatorModelId,
  };
}

/**
 * Batch evaluate multiple outputs in parallel
 */
export async function evaluateOutputs(
  outputs: Array<{ modelId: string; output: string }>,
  benchmarkPrompt: string,
  categories: string[],
  evaluatorModelId: string,
  evaluatorProvider?: "openai" | "anthropic" | "openrouter" | "custom",
  evaluatorApiKey?: string
): Promise<EvaluationResult[]> {
  // Evaluate all outputs in parallel for significant performance improvement
  // Instead of waiting for each evaluation sequentially, we run them concurrently
  const evaluationPromises = outputs.map(({ modelId, output }) =>
    evaluateOutput({
      modelId,
      output,
      prompt: benchmarkPrompt,
      categories,
      evaluatorModelId,
      evaluatorProvider,
      evaluatorApiKey,
      benchmarkId: "", // Not used for evaluation
    })
  );

  // Wait for all evaluations to complete
  // If one fails, we still want to return the successful ones
  const results = await Promise.allSettled(evaluationPromises);

  // Extract successful results and log failures
  const finalResults: EvaluationResult[] = [];
  for (let i = 0; i < results.length; i++) {
    const settledResult = results[i];
    if (settledResult?.status === "fulfilled") {
      finalResults.push(settledResult.value);
    } else {
      // Log failure but don't fail the entire batch
      const errorResult = settledResult as PromiseRejectedResult | undefined;
      console.error("[Evaluator] Evaluation failed for model", {
        modelId: outputs[i]?.modelId,
        error: errorResult?.reason instanceof Error ? errorResult.reason.message : String(errorResult?.reason),
      });
      // Add a fallback result for failed evaluations
      finalResults.push({
        modelId: outputs[i]?.modelId ?? "unknown",
        categoryEvaluations: [],
        totalScore: 0,
        aiConfidence: 0,
        evaluator: evaluatorModelId,
      });
    }
  }

  return finalResults;
}

/**
 * Simple text comparison for fallback evaluation
 * Used when AI evaluator is not available
 */
export function simpleTextComparison(
  _prompt: string,
  outputs: Array<{ modelId: string; output: string }>
): EvaluationResult[] {
  // Simple heuristic: longer output with more unique words might be better
  // This is a fallback only
  return outputs.map(({ modelId, output }) => {
    // Handle empty or whitespace-only output
    const trimmedOutput = output.trim();
    if (!trimmedOutput) {
      return {
        modelId,
        categoryEvaluations: [],
        totalScore: 0,
        aiConfidence: 0.3, // Low confidence for simple heuristic
        evaluator: "simple-fallback",
      };
    }

    const wordCount = output.split(/\s+/).length;
    const uniqueWords = new Set(output.toLowerCase().split(/\s+/)).size;
    // Guard against division by zero for empty/whitespace-only strings
    const uniqueRatio = wordCount > 0 ? uniqueWords / wordCount : 0;

    // Normalize to 0-100
    const score = Math.min(100, Math.max(0, uniqueRatio * 100));

    return {
      modelId,
      categoryEvaluations: [],
      totalScore: score,
      aiConfidence: 0.3, // Low confidence for simple heuristic
      evaluator: "simple-fallback",
    };
  });
}
