/**
 * API Routes for Models
 *
 * POST /api/models - Register a new model manually
 * GET /api/models - Get all registered models (including manually registered)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse, getStatusCode, ValidationError } from "@/lib/errors";
import { logError } from "@/lib/errors";
import { z } from "zod";

const RegisterModelSchema = z.object({
  modelId: z.string().min(1, "Model ID is required"),
  name: z.string().min(1, "Name is required").optional(),
  provider: z.enum(["OPENAI", "ANTHROPIC", "OPENROUTER", "CUSTOM"]).optional(),
  description: z.string().optional(),
});

/**
 * GET handler - Get all registered models
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const includePredefined = searchParams.get("includePredefined") === "true";

    // Get manually registered models from database
    const models = await prisma.model.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
    });

    // If includePredefined, add predefined models from settings
    const allModels = models.map((m) => ({
      id: m.id,
      modelId: m.providerId,
      name: m.name,
      provider: m.provider,
      description: m.description,
      isActive: m.isActive,
      isManuallyRegistered: true,
      createdAt: m.createdAt,
    }));

    if (includePredefined) {
      // Add predefined models from code
      const predefinedModels = [
        { id: "gpt-4o", name: "GPT-4o", provider: "OPENAI" as const, isPredefined: true },
        { id: "gpt-4o-mini", name: "GPT-4o Mini", provider: "OPENAI" as const, isPredefined: true },
        { id: "gpt-4-turbo", name: "GPT-4 Turbo", provider: "OPENAI" as const, isPredefined: true },
        { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo", provider: "OPENAI" as const, isPredefined: true },
        { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet", provider: "ANTHROPIC" as const, isPredefined: true },
        { id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet", provider: "ANTHROPIC" as const, isPredefined: true },
        { id: "claude-3-opus", name: "Claude 3 Opus", provider: "ANTHROPIC" as const, isPredefined: true },
        { id: "claude-3-sonnet", name: "Claude 3 Sonnet", provider: "ANTHROPIC" as const, isPredefined: true },
      ];

      // Merge, avoiding duplicates
      const existingIds = new Set(allModels.map((m) => m.modelId));
      const additionalModels = predefinedModels
        .filter((predefined) => !existingIds.has(predefined.id))
        .map((predefined) => ({
          id: `predefined-${predefined.id}`,
          modelId: predefined.id,
          name: predefined.name,
          provider: predefined.provider,
          description: null as string | null,
          isActive: true,
          isManuallyRegistered: false,
          isPredefined: true,
          createdAt: new Date(),
        }));

      allModels.push(...additionalModels);
    }

    return NextResponse.json({
      models: allModels,
      total: allModels.length,
    });
  } catch (error) {
    logError(error, { context: "GET /api/models" });

    const response = errorResponse(error);

    if (error instanceof Error) {
      return NextResponse.json(response, {
        status: getStatusCode(error as any),
      });
    }

    return NextResponse.json(response, { status: 500 });
  }
}

/**
 * POST handler - Register a new model manually
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.info("[POST /api/models] Registering model:", body);

    const validationResult = RegisterModelSchema.safeParse(body);

    if (!validationResult.success) {
      throw new ValidationError("Invalid model data", validationResult.error.flatten());
    }

    const { modelId, name, provider, description } = validationResult.data;

    // Auto-detect provider from modelId if not provided
    let detectedProvider = provider;
    if (!detectedProvider) {
      if (modelId.includes("/")) {
        detectedProvider = "OPENROUTER";
      } else if (modelId.startsWith("gpt-")) {
        detectedProvider = "OPENAI";
      } else if (modelId.startsWith("claude-")) {
        detectedProvider = "ANTHROPIC";
      } else {
        detectedProvider = "CUSTOM";
      }
    }

    // Check if model already exists
    const existing = await prisma.model.findFirst({
      where: { providerId: modelId },
    });

    if (existing) {
      // Reactivate if inactive
      if (!existing.isActive) {
        await prisma.model.update({
          where: { id: existing.id },
          data: { isActive: true },
        });
      }

      return NextResponse.json({
        success: true,
        message: "Model already registered",
        model: {
          id: existing.id,
          modelId: existing.providerId,
          name: existing.name,
          provider: existing.provider,
          description: existing.description,
          isActive: existing.isActive,
          isManuallyRegistered: true,
        },
      }, { status: 200 });
    }

    // Create new model
    const model = await prisma.model.create({
      data: {
        name: name || modelId,
        providerId: modelId,
        provider: detectedProvider,
        description: description || `${modelId} - manually registered`,
        isActive: true,
      },
    });

    console.info("[POST /api/models] Model registered:", {
      id: model.id,
      modelId: model.providerId,
    });

    return NextResponse.json({
      success: true,
      message: "Model registered successfully",
      model: {
        id: model.id,
        modelId: model.providerId,
        name: model.name,
        provider: model.provider,
        description: model.description,
        isActive: model.isActive,
        isManuallyRegistered: true,
      },
    }, { status: 201 });
  } catch (error) {
    logError(error, { context: "POST /api/models" });

    const response = errorResponse(error);

    if (error instanceof Error) {
      return NextResponse.json(response, {
        status: getStatusCode(error as any),
      });
    }

    return NextResponse.json(response, { status: 500 });
  }
}

/**
 * DELETE handler - Unregister (deactivate) a model
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const modelId = searchParams.get("modelId");

    if (!modelId) {
      throw new ValidationError("Model ID is required", {
        modelId: "Model ID query parameter is required",
      });
    }

    // Deactivate the model
    const result = await prisma.model.updateMany({
      where: { providerId: modelId },
      data: { isActive: false },
    });

    if (result.count === 0) {
      return NextResponse.json({
        success: false,
        message: "Model not found",
      }, { status: 404 });
    }

    console.info("[DELETE /api/models] Model deactivated:", { modelId });

    return NextResponse.json({
      success: true,
      message: "Model deactivated successfully",
    });
  } catch (error) {
    logError(error, { context: "DELETE /api/models" });

    const response = errorResponse(error);

    if (error instanceof Error) {
      return NextResponse.json(response, {
        status: getStatusCode(error as any),
      });
    }

    return NextResponse.json(response, { status: 500 });
  }
}
