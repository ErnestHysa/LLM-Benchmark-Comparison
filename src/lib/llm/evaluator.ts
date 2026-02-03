/**
 * AI Evaluator Service
 *
 * Uses an LLM to evaluate outputs and assign scores
 * based on defined metrics and categories
 */

import type {
  ChatMessage,
  LLMRequestOptions,
} from "./types.js";
import { getOpenAIClient, type OpenAIClient } from "./openai.js";
import { getAnthropicClient, type AnthropicClient } from "./anthropic.js";
import { getOpenRouterClient, type OpenRouterClient } from "./openrouter.js";
import { getCustomClient, type CustomAPIClient } from "./custom.js";
import { LLMError } from "../errors.js";

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
    throw new LLMError("Evaluator", "Failed to extract JSON from evaluation response");
  }

  try {
    const jsonStr = jsonMatch[1] || jsonMatch[0];
    return JSON.parse(jsonStr);
  } catch (error) {
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
    maxTokens: 4096,
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
      const weight = metricDef?.weight ?? 1;

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
  const totalScore =
    categoryEvaluations.reduce((sum, cat) => sum + cat.totalScore, 0) / categoryEvaluations.length;

  return {
    modelId,
    categoryEvaluations,
    totalScore,
    aiConfidence: evaluation.overallConfidence || 0.8,
    evaluator: evaluatorModelId,
  };
}

/**
 * Batch evaluate multiple outputs
 */
export async function evaluateOutputs(
  outputs: Array<{ modelId: string; output: string }>,
  benchmarkPrompt: string,
  categories: string[],
  evaluatorModelId: string,
  evaluatorProvider?: "openai" | "anthropic" | "openrouter" | "custom",
  evaluatorApiKey?: string
): Promise<EvaluationResult[]> {
  const results: EvaluationResult[] = [];

  for (const { modelId, output } of outputs) {
    const result = await evaluateOutput({
      modelId,
      output,
      prompt: benchmarkPrompt,
      categories,
      evaluatorModelId,
      evaluatorProvider,
      evaluatorApiKey,
      benchmarkId: "", // Not used for evaluation
    });

    results.push(result);
  }

  return results;
}

/**
 * Simple text comparison for fallback evaluation
 * Used when AI evaluator is not available
 */
export function simpleTextComparison(
  prompt: string,
  outputs: Array<{ modelId: string; output: string }>
): EvaluationResult[] {
  // Simple heuristic: longer output with more unique words might be better
  // This is a fallback only
  return outputs.map(({ modelId, output }) => {
    const wordCount = output.split(/\s+/).length;
    const uniqueWords = new Set(output.toLowerCase().split(/\s+/)).size;
    const uniqueRatio = uniqueWords / wordCount;

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
