/**
 * Test API Connection Endpoint
 *
 * Tests if an API key is valid by calling the provider's /models endpoint
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { type ModelProvider } from "@/lib/validators";
import { SettingsProviderEnum } from "@/lib/settings";

/**
 * Request schema
 */
const TestApiSchema = z.object({
  provider: SettingsProviderEnum,
  apiKey: z.string().min(1, "API key is required"),
  customEndpoint: z.string().optional(),
});

/**
 * Provider endpoints for testing
 */
const PROVIDER_ENDPOINTS: Record<ModelProvider, string> = {
  OPENAI: "https://api.openai.com/v1/models",
  ANTHROPIC: "https://api.anthropic.com/v1/models",
  OPENROUTER: "https://openrouter.ai/api/v1/models",
  CUSTOM: "", // Must be provided in request
};

/**
 * Provider-specific headers
 */
function getHeaders(provider: ModelProvider, apiKey: string): Record<string, string> {
  switch (provider) {
    case "OPENAI":
      return {
        Authorization: `Bearer ${apiKey}`,
      };
    case "ANTHROPIC":
      return {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      };
    case "OPENROUTER":
      return {
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "",
        "X-Title": "LLM Benchmark Comparison",
      };
    case "CUSTOM":
      return {
        Authorization: `Bearer ${apiKey}`,
      };
    default:
      return {};
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { provider, apiKey, customEndpoint } = TestApiSchema.parse(body);

    // Determine endpoint
    let endpoint = PROVIDER_ENDPOINTS[provider];
    if (provider === "CUSTOM") {
      if (!customEndpoint) {
        return NextResponse.json(
          { error: "Custom endpoint is required for CUSTOM provider" },
          { status: 400 }
        );
      }
      endpoint = customEndpoint;
    }

    // Make test request
    const headers = getHeaders(provider, apiKey);

    const response = await fetch(endpoint, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    // Check response
    if (response.ok) {
      const data = await response.json();

      // Extract models list based on provider response format
      let models: string[] = [];
      if (provider === "OPENAI" && data.data) {
        models = data.data.map((m: { id: string }) => m.id);
      } else if (provider === "ANTHROPIC" && data.data) {
        models = data.data.map((m: { id: string }) => m.id);
      } else if (provider === "OPENROUTER" && data.data) {
        models = data.data.map((m: { id: string }) => m.id);
      }

      return NextResponse.json({
        success: true,
        message: "Connection successful",
        models: models.slice(0, 10), // Return first 10 models
        totalModels: models.length,
      });
    }

    // Handle specific error codes
    if (response.status === 401) {
      return NextResponse.json(
        { success: false, message: "Invalid API key" },
        { status: 200 } // Return 200 with success: false for better client handling
      );
    }

    if (response.status === 429) {
      return NextResponse.json(
        { success: false, message: "Rate limit exceeded. Please try again later." },
        { status: 200 }
      );
    }

    // Other errors
    const errorText = await response.text().catch(() => "Unknown error");
    return NextResponse.json(
      {
        success: false,
        message: `API error (${response.status}): ${errorText.slice(0, 100)}`,
      },
      { status: 200 }
    );
  } catch (error) {
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: error.errors[0]?.message || "Validation error" },
        { status: 400 }
      );
    }

    // Handle timeout
    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json(
        { success: false, message: "Request timed out. Please check your connection." },
        { status: 200 }
      );
    }

    console.error("Test API error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to test API connection" },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for testing evaluator
 *
 * Tests by calling the provider's /models endpoint to verify API key is valid.
 * Does NOT check if the specific model exists - model validation happens during benchmark runs.
 */
const TestEvaluatorSchema = z.object({
  model: z.string().min(1),
  provider: SettingsProviderEnum,
  apiKey: z.string().min(1),
  customEndpoint: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  try {
    const params = TestEvaluatorSchema.parse(Object.fromEntries(searchParams));

    console.info("[Evaluator Test] Testing evaluator:", {
      provider: params.provider,
      model: params.model,
      hasApiKey: !!params.apiKey,
      apiKeyPrefix: params.apiKey.slice(0, 10) + "...",
    });

    // Determine the /models endpoint for this provider
    let endpoint = "";
    let headers: Record<string, string> = {};

    switch (params.provider) {
      case "OPENAI":
        endpoint = "https://api.openai.com/v1/models";
        headers = {
          Authorization: `Bearer ${params.apiKey}`,
        };
        break;

      case "ANTHROPIC":
        endpoint = "https://api.anthropic.com/v1/models";
        headers = {
          "x-api-key": params.apiKey,
          "anthropic-version": "2023-06-01",
        };
        break;

      case "OPENROUTER":
        endpoint = "https://openrouter.ai/api/v1/models";
        headers = {
          Authorization: `Bearer ${params.apiKey}`,
          "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "",
          "X-Title": "LLM Benchmark Comparison",
        };
        break;

      case "CUSTOM":
        if (!params.customEndpoint) {
          return NextResponse.json(
            { success: false, message: "Custom endpoint is required" },
            { status: 400 }
          );
        }
        // For custom endpoints, try the /models path
        const url = new URL(params.customEndpoint);
        url.pathname = "/models";
        endpoint = url.toString();
        headers = {
          Authorization: `Bearer ${params.apiKey}`,
        };
        break;
    }

    console.info("[Evaluator Test] Fetching:", endpoint);

    const response = await fetch(endpoint, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(10000),
    });

    console.info("[Evaluator Test] Response status:", response.status);

    // If API key is valid (200 OK), return success immediately
    // We don't check if the model exists - that happens during benchmark runs
    if (response.ok) {
      const data = await response.json();
      console.info("[Evaluator Test] API key validated successfully");

      return NextResponse.json({
        success: true,
        message: "API key is valid. Evaluator configured.",
        // Optionally include sample models for UX
        availableModels: data.data?.slice?.(0, 5).map((m: { id: string }) => m.id) || [],
      });
    }

    // Handle errors - get the actual error message
    const errorText = await response.text().catch(() => "Unknown error");
    console.warn("[Evaluator Test] Error response:", {
      status: response.status,
      statusText: response.statusText,
      body: errorText.slice(0, 500),
    });

    if (response.status === 401) {
      return NextResponse.json(
        { success: false, message: "Invalid API key for evaluator" },
        { status: 200 }
      );
    }

    if (response.status === 429) {
      return NextResponse.json(
        { success: false, message: "Rate limit exceeded. Please try again later." },
        { status: 200 }
      );
    }

    // Parse JSON error for better messages
    let errorMessage = `API error (${response.status})`;
    try {
      const errorJson = JSON.parse(errorText);
      if (errorJson.error?.message) {
        errorMessage = errorJson.error.message;
      } else if (errorJson.message) {
        errorMessage = errorJson.message;
      }
    } catch {
      // Not JSON
      if (errorText && errorText !== "Unknown error") {
        errorMessage = `${errorMessage}: ${errorText.slice(0, 200)}`;
      }
    }

    return NextResponse.json(
      { success: false, message: errorMessage },
      { status: 200 }
    );
  } catch (error) {
    console.error("[Evaluator Test] Exception:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: error.errors[0]?.message || "Validation error" },
        { status: 400 }
      );
    }

    // Handle timeout
    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json(
        { success: false, message: "Request timed out. Please check your connection." },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { success: false, message: `Failed to test evaluator: ${error instanceof Error ? error.message : "Unknown error"}` },
      { status: 500 }
    );
  }
}
