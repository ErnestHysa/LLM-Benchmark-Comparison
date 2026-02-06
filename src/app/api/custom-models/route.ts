/**
 * Custom Models API
 *
 * GET /api/custom-models - Get user's custom models from database
 * POST /api/custom-models - Sync custom models from localStorage to database
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse, getStatusCode } from "@/lib/errors";
import { logError } from "@/lib/errors";
import { z } from "zod";

const SyncModelsSchema = z.object({
  models: z.array(z.object({
    id: z.string(),
    name: z.string(), // This is the provider ID (e.g., "z-ai/glm-4.5-air:free")
    displayName: z.string(),
    provider: z.enum(["OPENAI", "ANTHROPIC", "OPENROUTER", "CUSTOM"]),
    description: z.string().optional(),
    isEnabled: z.boolean(),
    isCustom: z.boolean(),
    apiEndpoint: z.string().optional(),
  })),
});

/**
 * GET handler - Get custom models from database
 */
export async function GET(_request: NextRequest) {
  try {
    const models = await prisma.model.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      models: models.map((m) => ({
        id: m.id,
        providerId: m.providerId,
        name: m.name,
        displayName: m.name,
        provider: m.provider,
        description: m.description,
        isCustom: true,
        isEnabled: m.isActive,
      })),
    });
  } catch (error) {
    logError(error, { context: "GET /api/custom-models" });
    const response = errorResponse(error);
    return NextResponse.json(response, {
      status: getStatusCode(error as any),
    });
  }
}

/**
 * POST handler - Sync custom models from localStorage to database
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validationResult = SyncModelsSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request body",
        },
      }, { status: 400 });
    }

    const { models: customModels } = validationResult.data;

    // Sync each custom model to database
    const results = await Promise.allSettled(
      customModels.map(async (model) => {
        // Check if model already exists by providerId
        const existing = await prisma.model.findFirst({
          where: { providerId: model.name },
        });

        if (existing) {
          // Update existing model
          return await prisma.model.update({
            where: { id: existing.id },
            data: {
              name: model.displayName,
              providerId: model.name,
              provider: model.provider,
              description: model.description,
              isActive: model.isEnabled,
            },
          });
        } else {
          // Create new model
          return await prisma.model.create({
            data: {
              name: model.displayName,
              providerId: model.name,
              provider: model.provider,
              description: model.description || `${model.name} - custom model`,
              isActive: model.isEnabled,
            },
          });
        }
      })
    );

    const synced = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    return NextResponse.json({
      success: true,
      message: `Synced ${synced} models${failed > 0 ? ` (${failed} failed)` : ""}`,
      synced,
      failed,
    });
  } catch (error) {
    logError(error, { context: "POST /api/custom-models" });
    const response = errorResponse(error);
    return NextResponse.json(response, {
      status: getStatusCode(error as any),
    });
  }
}
