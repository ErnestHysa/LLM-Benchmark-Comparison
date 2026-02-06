/**
 * POST /api/compare/run - Run A/B comparison between models
 *
 * Generates blind A/B test results
 */

import { NextRequest, NextResponse } from "next/server";
import { chat } from "@/lib/llm";
import { generateDiff, calculateSimilarity, calculateBattleScore } from "@/lib/abtest/comparison";
import { LLMError } from "@/lib/errors";

export async function POST(request: NextRequest) {
  // Create abort controller for timeout - must be created outside try for proper cleanup
  const timeoutController = new AbortController();
  const timeoutMs = 300000; // 5 minute timeout for comparison (OpenRouter free models can be slow)
  const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);

  // Clean up timeout on completion
  const cleanupTimeout = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  };

  // Combine request.signal with our timeout signal
  const combinedAbortController = new AbortController();

  // Abort if either the request is aborted or timeout occurs
  const abortHandler = () => combinedAbortController.abort();
  request.signal.addEventListener("abort", abortHandler);
  timeoutController.signal.addEventListener("abort", abortHandler);

  try {
    const body = await request.json();

    if (!body.prompt || !body.modelA || !body.modelB) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "prompt, modelA, and modelB are required" } },
        { status: 400 }
      );
    }

    // Use maxTokens from request or default to 8192 (global preference)
    const maxTokens = body.maxTokens || 8192;

    // Generate responses from both models with timeout and abort signal
    // Use Promise.allSettled to handle partial failures (one model succeeds, one fails)
    const results = await Promise.allSettled([
      chat(body.modelA, [{ role: "user", content: body.prompt }], {
        temperature: 0.7,
        maxTokens,
        timeoutMs,
        abortSignal: combinedAbortController.signal,
      }, body.apiKeys),
      chat(body.modelB, [{ role: "user", content: body.prompt }], {
        temperature: 0.7,
        maxTokens,
        timeoutMs,
        abortSignal: combinedAbortController.signal,
      }, body.apiKeys),
    ]);

    // Extract results with fallbacks for failed models
    let responseA, responseB, errorA, errorB;

    if (results[0].status === "fulfilled") {
      responseA = results[0].value;
    } else {
      errorA = results[0].reason;
      console.error("[Compare] Model A failed:", errorA);
    }

    if (results[1].status === "fulfilled") {
      responseB = results[1].value;
    } else {
      errorB = results[1].reason;
      console.error("[Compare] Model B failed:", errorB);
    }

    // If both failed, return error
    if (!responseA && !responseB) {
      return NextResponse.json(
        {
          error: {
            code: "BOTH_MODELS_FAILED",
            message: "Both models failed to generate a response",
            details: {
              modelAError: errorA instanceof Error ? errorA.message : String(errorA),
              modelBError: errorB instanceof Error ? errorB.message : String(errorB),
            }
          }
        },
        { status: 500 }
      );
    }

    // Calculate diff and similarity with null checks - use empty string for failed models
    const contentA = responseA?.content || "";
    const contentB = responseB?.content || "";
    const diff = generateDiff(contentA, contentB);
    const similarity = calculateSimilarity(contentA, contentB);
    const battleScore = calculateBattleScore(contentA, contentB);

    // Get error messages
    const getErrorMessage = (err: unknown): string | undefined => {
      if (err instanceof LLMError) {
        return err.message; // LLMError.message doesn't include provider prefix
      }
      if (err instanceof Error) {
        return err.message;
      }
      return String(err);
    };

    return NextResponse.json({
      prompt: body.prompt,
      modelA: body.modelA,
      modelB: body.modelB,
      responseA: {
        output: contentA,
        tokensUsed: responseA?.tokensUsed,
        error: errorA ? getErrorMessage(errorA) : undefined,
      },
      responseB: {
        output: contentB,
        tokensUsed: responseB?.tokensUsed,
        error: errorB ? getErrorMessage(errorB) : undefined,
      },
      diff,
      similarity,
      battleScore,
      partialFailure: !responseA || !responseB,
    });
  } catch (error) {
    console.error("[POST /api/compare/run] Error:", error);

    // Handle timeout specifically
    if (error instanceof Error && error.message === "Request timeout") {
      return NextResponse.json(
        { error: { code: "TIMEOUT_ERROR", message: "Comparison request timed out. Please try again." } },
        { status: 408 }
      );
    }

    // Handle abort specifically
    if (error instanceof Error && error.message === "Request aborted") {
      return NextResponse.json(
        { error: { code: "ABORTED", message: "Comparison was cancelled" } },
        { status: 499 }
      );
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to run comparison" } },
      { status: 500 }
    );
  } finally {
    // Always clean up resources
    cleanupTimeout();
    request.signal.removeEventListener("abort", abortHandler);
  }
}
